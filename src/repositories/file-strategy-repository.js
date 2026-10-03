import { guestVisible, guestQuota } from "../services/security/guest-retention.js";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  isR2Configured,
  loadJSONFromR2,
  readStrategyObject,
  writeStrategyObject,
  deleteStrategyObject,
} from "../http/r2-storage.js";
import { TenantLockManager } from "./tenant-lock.js";
import { storageCorruption, writeJsonAtomically } from "./atomic-json-store.js";

export class FileStrategyRepository {
  /**
   * @param {string} filePath - Path to strategies.json or strategies directory
   * @param {any} redis - Optional Redis client
   * @param {object} options - Optional overrides for cloud functions
   */
  constructor(filePath, redis = null, options = {}) {
    this.filePath = filePath;
    this.redis = redis;
    this.cloud = options.cloud ?? isR2Configured();
    this.readCloud = options.readCloud || readStrategyObject;
    this.writeCloud = options.writeCloud || writeStrategyObject;
    this.deleteCloud = options.deleteCloud || deleteStrategyObject;

    // Resolve directories and legacy file paths
    if (filePath && path.extname(filePath) === ".json") {
      this.legacyFilePath = filePath;
      this.strategiesDir = path.join(path.dirname(filePath), "strategies");
    } else {
      this.legacyFilePath = filePath ? path.join(filePath, "strategies.json") : null;
      this.strategiesDir = filePath
        ? (path.basename(filePath) === "strategies" ? filePath : path.join(filePath, "strategies"))
        : path.join(process.cwd(), "data", "strategies");
    }

    const baseLockDir = this.strategiesDir
      ? path.dirname(this.strategiesDir)
      : path.join(process.cwd(), "data");
    this.lockManager = new TenantLockManager(baseLockDir);

    // In-memory per-tenant queue Map: tenantKey -> Promise
    this.tenantQueues = new Map();

    // Migration memoization promise
    this._migrationPromise = null;
  }

  /**
   * Compute deterministic 64-character SHA-256 tenant hash.
   * @param {string} ownerId
   * @returns {string}
   */
  tenantKey(ownerId) {
    if (!ownerId || typeof ownerId !== "string") {
      throw new Error("Invalid ownerId for strategy repository");
    }
    return createHash("sha256").update(ownerId.trim()).digest("hex");
  }

  /**
   * Local filesystem path for tenant shard.
   * @param {string} tenantKey
   * @returns {string}
   */
  tenantFilePath(tenantKey) {
    return path.join(this.strategiesDir, `${tenantKey}.json`);
  }

  /**
   * Redis key for tenant strategies.
   * @param {string} ownerId
   * @returns {string}
   */
  tenantRedisKey(ownerId) {
    return `marketify:store:strategies:${ownerId}`;
  }

  /**
   * Ensure storage directory exists and startup migration has executed.
   */
  async ensure() {
    await fs.mkdir(this.strategiesDir, { recursive: true });
    await this.ensureMigrated();
  }

  /**
   * Idempotent migration trigger.
   */
  async ensureMigrated() {
    if (!this._migrationPromise) {
      this._migrationPromise = this.migrateLegacyStrategiesIfPresent();
    }
    return this._migrationPromise;
  }

  /**
   * Migrate legacy monolithic strategies.json / Redis / R2 into per-tenant shards.
   */
  async migrateLegacyStrategiesIfPresent() {
    let legacyRecords = null;

    // 1. Check local legacy file
    if (this.legacyFilePath) {
      try {
        const raw = await fs.readFile(this.legacyFilePath, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          legacyRecords = parsed;
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error("Error reading legacy local strategies.json:", err?.message || err);
        }
      }
    }

    // 2. Check R2 legacy object if not found locally
    if ((!legacyRecords || legacyRecords.length === 0) && (this.cloud ?? isR2Configured())) {
      try {
        const r2Data = await loadJSONFromR2("strategies.json");
        if (Array.isArray(r2Data) && r2Data.length > 0) {
          legacyRecords = r2Data;
        }
      } catch (err) {
        console.error("Error reading legacy R2 strategies.json:", err?.message || err);
      }
    }

    // 3. Check legacy Redis global key if still empty
    if ((!legacyRecords || legacyRecords.length === 0) && this.redis?.isReady) {
      try {
        const rawRedis = await this.redis.get("marketify:store:strategies");
        if (rawRedis) {
          const parsed = JSON.parse(rawRedis);
          if (Array.isArray(parsed) && parsed.length > 0) {
            legacyRecords = parsed;
          }
        }
      } catch (err) {
        console.error("Error reading legacy Redis strategies:", err?.message || err);
      }
    }

    if (!legacyRecords || !Array.isArray(legacyRecords) || legacyRecords.length === 0) {
      return { migratedCount: 0, tenantsCount: 0 };
    }

    console.log(`[FileStrategyRepository] Discovered ${legacyRecords.length} legacy strategies. Migrating to per-tenant shards...`);

    // Group by ownerId
    const byOwner = new Map();
    for (const record of legacyRecords) {
      if (!record || !record.ownerId) continue;
      if (!byOwner.has(record.ownerId)) {
        byOwner.set(record.ownerId, []);
      }
      byOwner.get(record.ownerId).push(record);
    }

    await fs.mkdir(this.strategiesDir, { recursive: true });

    let migratedRecordsCount = 0;
    for (const [ownerId, records] of byOwner.entries()) {
      const tenantKey = this.tenantKey(ownerId);
      const { records: existing, etag, tombstone } = await this.readTenantDataWithEtag(ownerId, tenantKey).catch(() => ({ records: [], etag: null, tombstone: false }));
      if (tombstone) {
        continue;
      }
      const existingIds = new Set((existing || []).map((r) => r.id));

      const merged = [...existing];
      for (const rec of records) {
        if (!existingIds.has(rec.id)) {
          merged.push(rec);
          existingIds.add(rec.id);
          migratedRecordsCount++;
        }
      }

      await this.writeLocalTenant(tenantKey, merged);

      if (this.redis?.isReady) {
        await this.redis.set(this.tenantRedisKey(ownerId), JSON.stringify(merged)).catch(() => {});
      }

      if (this.cloud ?? isR2Configured()) {
        let currentEtag = etag;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const success = await this.writeCloud(tenantKey, merged, currentEtag);
            if (success) break;
          } catch (err) {
            console.error(`Failed to migrate shard to R2 for tenant ${tenantKey}:`, err?.message || err);
            break;
          }
          const fresh = await this.readTenantDataWithEtag(ownerId, tenantKey).catch(() => null);
          if (!fresh || fresh.tombstone) break;
          currentEtag = fresh.etag;
        }
      }
    }

    // Rename legacy file to .migrated backup
    if (this.legacyFilePath) {
      try {
        const backupPath = `${this.legacyFilePath}.migrated`;
        await fs.rename(this.legacyFilePath, backupPath).catch(() => {});
      } catch {}
    }

    console.log(`[FileStrategyRepository] Successfully migrated ${migratedRecordsCount} records across ${byOwner.size} tenants.`);
    return { migratedCount: migratedRecordsCount, tenantsCount: byOwner.size };
  }

  /**
   * Execute an operation inside a per-tenant in-memory serialized queue.
   * Guarantees concurrent operations on the same tenant never interleave.
   * @param {string} ownerId
   * @param {(tenantKey: string) => Promise<any>} fn
   * @returns {Promise<any>}
   */
  async runInTenantLock(ownerId, fn) {
    const tenantKey = this.tenantKey(ownerId);
    return this.lockManager.runInLock(tenantKey, () => fn(tenantKey));
  }

  /**
   * Alias for runInTenantLock.
   */
  async withTenantLock(ownerId, fn) {
    return this.runInTenantLock(ownerId, fn);
  }

  /**
   * Lock across multiple tenant IDs in deterministic order to prevent deadlocks.
   */
  async withTenantLocks(ownerId1, ownerId2, fn) {
    const key1 = this.tenantKey(ownerId1);
    const key2 = this.tenantKey(ownerId2);
    return this.lockManager.runInMultiLock([key1, key2], () => fn());
  }

  /**
   * Read tenant records and R2 ETag across R2, Redis, and local filesystem.
   * @param {string} ownerId
   * @param {string} tenantKey
   * @returns {Promise<{ records: any[], etag: string | null, tombstone?: boolean, deletedAt?: string }>}
   */
  async readTenantDataWithEtag(ownerId, tenantKey) {
    // 1. Try Cloudflare R2
    if (this.cloud) {
      try {
        const res = await this.readCloud(tenantKey);
        const { record, etag, notFound, tombstone } = res || {};
        if (tombstone || (record && typeof record === "object" && !Array.isArray(record) && record._tombstone)) {
          // Explicit tombstone detected: clean up local shard cache and Redis to prevent resurrection
          await fs.rm(this.tenantFilePath(tenantKey), { force: true }).catch(() => {});
          if (this.redis?.isReady) {
            await this.redis.del(this.tenantRedisKey(ownerId)).catch(() => {});
          }
          return { records: [], etag, tombstone: true, deletedAt: record?.deletedAt };
        }
        if (record && Array.isArray(record)) {
          await this.writeLocalTenant(tenantKey, record).catch(() => {});
          if (this.redis?.isReady) {
            await this.redis.set(this.tenantRedisKey(ownerId), JSON.stringify(record)).catch(() => {});
          }
          return { records: record, etag, tombstone: false };
        }
        if (notFound || record === null) {
          // Authoritative cloud object does NOT exist! Clean up any stale local file
          await fs.rm(this.tenantFilePath(tenantKey), { force: true }).catch(() => {});
          if (this.redis?.isReady) {
            await this.redis.del(this.tenantRedisKey(ownerId)).catch(() => {});
          }
          return { records: [], etag: null, tombstone: false };
        }
        throw storageCorruption("Invalid authoritative tenant shard structure.");
      } catch (err) {
        console.error(`R2 strategy read error (${tenantKey}):`, err?.message || err);
        throw err;
      }
    }

    // Local disk is authoritative; Redis may contain a stale mirror after an outage.
    const targetPath = this.tenantFilePath(tenantKey);
    try {
      const raw = await fs.readFile(targetPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed._tombstone) {
        return { records: [], etag: null, tombstone: true, deletedAt: parsed.deletedAt };
      }
      if (!Array.isArray(parsed)) throw storageCorruption("Invalid tenant shard structure.");
      const records = parsed;
      if (records.length > 0 && this.redis?.isReady) {
        await this.redis.set(this.tenantRedisKey(ownerId), JSON.stringify(records)).catch(() => {});
      }
      return { records, etag: null, tombstone: false };
    } catch (error) {
      if (error.code === "ENOENT") {
        return { records: [], etag: null, tombstone: false };
      }
      if (error instanceof SyntaxError) {
        throw storageCorruption(`Strategy shard ${tenantKey} contains invalid JSON.`, error);
      }
      throw error;
    }
  }

  /**
   * Atomic local write using PID + UUID temporary file followed by fs.rename.
   * @param {string} tenantKey
   * @param {any[]} records
   */
  async writeLocalTenant(tenantKey, records) {
    await fs.mkdir(this.strategiesDir, { recursive: true });
    await writeJsonAtomically(this.tenantFilePath(tenantKey), records);
  }

  /**
   * Optimistic Concurrency Control (OCC) mutation wrapper.
   * Wraps read-modify-write inside in-process tenant queue and retries up to 10 times on R2 412 conflicts.
   * @param {string} ownerId
   * @param {(records: any[]) => { records?: any[], result?: any } | any} mutator
   * @returns {Promise<any>}
   */
  async mutateTenant(ownerId, mutator) {
    await this.ensureMigrated();

    return this.runInTenantLock(ownerId, async (tenantKey) => {
      const isCloud = this.cloud ?? isR2Configured();
      const maxAttempts = isCloud ? 10 : 1;
      const mutationStartedAt = Date.now();

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { records, etag, tombstone, deletedAt } = await this.readTenantDataWithEtag(ownerId, tenantKey);

        if (tombstone) {
          return null;
        }

        const recordsCopy = JSON.parse(JSON.stringify(records));

        const mutatorOutput = await mutator(recordsCopy);
        const nextRecords = mutatorOutput?.records !== undefined
          ? mutatorOutput.records
          : (Array.isArray(mutatorOutput) ? mutatorOutput : recordsCopy);
        const returnValue = mutatorOutput?.result !== undefined ? mutatorOutput.result : mutatorOutput;

        // Perform R2 conditional PUT with OCC ETag
        if (isCloud) {
          const success = await this.writeCloud(tenantKey, nextRecords, etag);
          if (!success) {
            // Precondition failed (412/409): wait with exponential jitter and retry
            await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 40) + attempt * 25));
            continue;
          }
        }

        // Commit to local filesystem and Redis
        await this.writeLocalTenant(tenantKey, nextRecords);

        if (this.redis?.isReady) {
          try {
            await this.redis.set(this.tenantRedisKey(ownerId), JSON.stringify(nextRecords));
          } catch (err) {
            console.error(`Redis strategy write error (${ownerId}):`, err?.message || err);
          }
        }

        return returnValue;
      }

      const err = new Error("Strategy storage concurrency conflict. Maximum retries exceeded.");
      err.code = "STORAGE_BUSY";
      err.statusCode = 503;
      throw err;
    });
  }

  /**
   * Read all records for a specific tenant.
   * @param {string} ownerId
   * @returns {Promise<any[]>}
   */
  async readTenant(ownerId) {
    await this.ensureMigrated();
    const tenantKey = this.tenantKey(ownerId);
    const { records, tombstone } = await this.readTenantDataWithEtag(ownerId, tenantKey);
    if (tombstone) return [];
    return Array.isArray(records) ? records.filter(record => guestVisible(record, ownerId)) : [];
  }

  /**
   * Backwards-compatible readAll method:
   * - If ownerId is provided, returns that tenant's records.
   * - If ownerId is omitted, aggregates records across all local tenant shard files.
   * @param {string} [ownerId]
   * @returns {Promise<any[]>}
   */
  async readAll(ownerId = null) {
    if (ownerId) {
      return this.readTenant(ownerId);
    }

    await this.ensure();

    try {
      const entries = await fs.readdir(this.strategiesDir, { withFileTypes: true });
      const aggregated = [];
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.endsWith(".tmp")) {
          try {
            const raw = await fs.readFile(path.join(this.strategiesDir, entry.name), "utf8");
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              aggregated.push(...parsed);
            }
          } catch {
            // Ignore malformed shard
          }
        }
      }
      return aggregated;
    } catch (err) {
      console.error("Error reading all strategy shards:", err?.message || err);
      return [];
    }
  }

  /**
   * Backwards-compatible writeAll method.
   * Partitions records by ownerId and persists to their respective shards.
   * @param {any[]} records
   */
  async writeAll(records) {
    await this.ensure();
    if (!Array.isArray(records)) return;

    const byOwner = new Map();
    for (const record of records) {
      if (!record || !record.ownerId) continue;
      if (!byOwner.has(record.ownerId)) byOwner.set(record.ownerId, []);
      byOwner.get(record.ownerId).push(record);
    }

    for (const [ownerId, tenantRecords] of byOwner.entries()) {
      await this.mutateTenant(ownerId, () => ({
        records: tenantRecords,
        result: true,
      }));
    }
  }

  /**
   * List all strategies for a given owner, sorted by updatedAt descending.
   * @param {string} ownerId
   * @returns {Promise<any[]>}
   */
  async list(ownerId) {
    if (!ownerId) return [];
    const records = await this.readTenant(ownerId);
    return records
      .filter((record) => record.ownerId === ownerId)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .map(({ versions, ownerId: _ownerId, clientSaveId: _clientSaveId, ...record }) => ({
        ...record,
        versionCount: (versions || []).length,
      }));
  }

  /**
   * Get single strategy by ID and ownerId.
   * @param {string} id
   * @param {string} ownerId
   * @returns {Promise<any | null>}
   */
  async getById(id, ownerId) {
    if (!id || !ownerId) return null;
    const records = await this.readTenant(ownerId);
    return records.find((record) => record.id === id && record.ownerId === ownerId) || null;
  }

  /**
   * Idempotently create a new strategy record for an owner.
   * @param {object} payload
   * @param {string} ownerId
   * @returns {Promise<object>}
   */
  async create(payload, ownerId) {
    if (!ownerId) throw new Error("ownerId is required to create a strategy");

    return this.mutateTenant(ownerId, (records) => {
      const duplicate = payload.clientSaveId
        ? records.find((record) => record.ownerId === ownerId && record.clientSaveId === payload.clientSaveId)
        : null;
      if (duplicate) return { records, result: duplicate };
      guestQuota(records, ownerId, 10, 1);

      const now = new Date().toISOString();
      const versions = (payload.versions || []).map((version) => ({
        ...version,
        id: version.id || randomUUID(),
      }));

      const record = {
        id: randomUUID(),
        ownerId,
        clientSaveId: payload.clientSaveId,
        payloadFingerprint: payload.payloadFingerprint || null,
        title: payload.strategy?.title || "Untitled Strategy",
        brief: payload.brief,
        clarification: { answers: payload.answers },
        strategy: payload.strategy,
        status: "saved",
        currentVersionId: versions.at(-1)?.id || randomUUID(),
        learningInteractionId: payload.learningInteractionId || null,
        versions,
        createdAt: now,
        updatedAt: now,
      };

      records.push(record);
      return { records, result: record };
    });
  }

  /**
   * Append a new version to an existing strategy.
   * @param {string} id
   * @param {string} ownerId
   * @param {object} strategy
   * @param {string} changeRequest
   * @param {object} [options]
   * @returns {Promise<object | null>}
   */
  async appendVersion(id, ownerId, strategy, changeRequest, options = {}) {
    if (!id || !ownerId) return null;

    return this.mutateTenant(ownerId, (records) => {
      const index = records.findIndex((record) => record.id === id && record.ownerId === ownerId);
      if (index === -1) return { records, result: null };

      const record = records[index];
      const completed = options.clientSaveId && (record.versions || []).find(version => version.clientSaveId === options.clientSaveId);
      if (completed) {
        if (completed.payloadFingerprint && completed.payloadFingerprint !== options.payloadFingerprint) {
          const error = new Error("Idempotency key was reused with different refinement parameters.");
          error.code = "IDEMPOTENCY_CONFLICT";
          error.status = 409;
          throw error;
        }
        return { records, result: record };
      }
      const version = {
        id: randomUUID(),
        versionNumber: (record.versions || []).length + 1,
        data: strategy,
        changeRequest,
        clientSaveId: options.clientSaveId || null,
        payloadFingerprint: options.payloadFingerprint || null,
        createdAt: new Date().toISOString(),
      };

      records[index] = {
        ...record,
        title: strategy.title || record.title,
        strategy,
        status: "saved",
        currentVersionId: version.id,
        versions: [...(record.versions || []), version],
        updatedAt: version.createdAt,
      };

      return { records, result: records[index] };
    });
  }

  /**
   * Update strategy title.
   * @param {string} id
   * @param {string} ownerId
   * @param {string} title
   * @returns {Promise<object | null>}
   */
  async updateTitle(id, ownerId, title) {
    if (!id || !ownerId || !title?.trim()) return null;
    const trimmedTitle = title.trim();

    return this.mutateTenant(ownerId, (records) => {
      const index = records.findIndex((record) => record.id === id && record.ownerId === ownerId);
      if (index === -1) return { records, result: null };

      const now = new Date().toISOString();
      const record = records[index];
      const updatedStrategy = record.strategy ? { ...record.strategy, title: trimmedTitle } : { title: trimmedTitle };
      const updatedVersions = (record.versions || []).map((v, i, arr) => {
        if (i === arr.length - 1 && v.data) {
          return { ...v, data: { ...v.data, title: trimmedTitle } };
        }
        return v;
      });

      records[index] = {
        ...record,
        title: trimmedTitle,
        strategy: updatedStrategy,
        versions: updatedVersions,
        updatedAt: now,
      };

      return { records, result: records[index] };
    });
  }

  /**
   * Duplicate an existing strategy.
   * @param {string} id
   * @param {string} ownerId
   * @returns {Promise<object | null>}
   */
  async duplicate(id, ownerId) {
    if (!id || !ownerId) return null;

    return this.mutateTenant(ownerId, (records) => {
      const original = records.find((record) => record.id === id && record.ownerId === ownerId);
      if (!original) return { records, result: null };

      if (original.deleted || !guestVisible(original, ownerId)) return { records, result: null };
      guestQuota(records, ownerId, 10, 1);
      const now = new Date().toISOString();
      const newId = randomUUID();
      const newTitle = `${original.title} (Kopiya)`;
      const newStrategy = original.strategy ? JSON.parse(JSON.stringify(original.strategy)) : { title: newTitle };
      newStrategy.title = newTitle;

      const versions = (original.versions || []).map((v) => ({
        ...v,
        id: randomUUID(),
        data: v.data ? JSON.parse(JSON.stringify(v.data)) : newStrategy,
      }));

      if (!versions.length) {
        versions.push({
          id: randomUUID(),
          versionNumber: 1,
          data: newStrategy,
          changeRequest: "Dublikat strategiya",
          createdAt: now,
        });
      } else {
        versions[versions.length - 1].data.title = newTitle;
      }

      const duplicateRecord = {
        ...original,
        id: newId,
        clientSaveId: randomUUID(),
        title: newTitle,
        strategy: newStrategy,
        versions,
        currentVersionId: versions.at(-1)?.id || randomUUID(),
        createdAt: now,
        updatedAt: now,
      };

      records.unshift(duplicateRecord);
      return { records, result: duplicateRecord };
    });
  }

  /**
   * Delete a single strategy by ID.
   * @param {string} id
   * @param {string} ownerId
   * @returns {Promise<boolean>}
   */
  async delete(id, ownerId) {
    if (!id || !ownerId) return false;

    return this.mutateTenant(ownerId, (records) => {
      const remaining = records.filter((record) => !(record.id === id && record.ownerId === ownerId));
      if (remaining.length === records.length) return { records, result: false };
      return { records: remaining, result: true };
    });
  }

  /**
   * Delete all strategies belonging to an owner.
   * @param {string} ownerId
   * @returns {Promise<number>}
   */
  async deleteAllByOwner(ownerId) {
    if (!ownerId) return 0;
    await this.ensure();

    return this.runInTenantLock(ownerId, async (tenantKey) => {
      const { records, etag } = await this.readTenantDataWithEtag(ownerId, tenantKey);
      const count = Array.isArray(records) ? records.length : 0;
      const now = new Date().toISOString();

      const tombstoneRecord = {
        _tombstone: true,
        deletedAt: now,
        ownerId,
      };

      // 1. In cloud mode, write OCC-protected tombstone with retry
      const isCloud = this.cloud ?? isR2Configured();
      if (isCloud) {
        let written = false;
        let currentEtag = etag;
        const maxRetries = 5;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            written = await this.writeCloud(tenantKey, tombstoneRecord, currentEtag);
            if (written) break;
          } catch (err) {
            console.error(`Failed to write tombstone to R2 for tenant ${tenantKey}:`, err?.message || err);
            throw err;
          }

          // Conflict: re-read to get fresh ETag
          const fresh = await this.readTenantDataWithEtag(ownerId, tenantKey);
          if (fresh.tombstone) {
            written = true;
            break;
          }
          currentEtag = fresh.etag;
          await new Promise((r) => setTimeout(r, 20 * Math.pow(2, attempt) + Math.random() * 20));
        }

        if (!written) {
          const conflictErr = new Error(`Tenant deletion conflict: failed to write tombstone after ${maxRetries} attempts`);
          conflictErr.code = "STORAGE_CONFLICT";
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
      }

      // 2. Write tombstone to local file using unique temp file + atomic rename
      const targetPath = this.tenantFilePath(tenantKey);
      const tempPath = `${targetPath}.${randomUUID()}.tmp`;
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(tempPath, `${JSON.stringify(tombstoneRecord, null, 2)}\n`, "utf8");
      await fs.rename(tempPath, targetPath);

      // 3. Remove from Redis ONLY AFTER authoritative commit
      if (this.redis?.isReady) {
        await this.redis.del(this.tenantRedisKey(ownerId)).catch(() => {});
      }

      return count;
    });
  }

  /**
   * Atomically migrate all strategies from previousOwnerId (guest) to ownerId (user).
   * @param {string} previousOwnerId
   * @param {string} ownerId
   * @returns {Promise<number>}
   */
  async claimOwner(previousOwnerId, ownerId) {
    if (!previousOwnerId || !ownerId || previousOwnerId === ownerId) return 0;
    await this.ensure();

    const guestKey = this.tenantKey(previousOwnerId);
    const userKey = this.tenantKey(ownerId);

    return this.withTenantLocks(previousOwnerId, ownerId, async () => {
      // 1. Read guest records with ETag
      const guestData = await this.readTenantDataWithEtag(previousOwnerId, guestKey);
      const guestRecords = Array.isArray(guestData.records) ? guestData.records.filter(record => !record.deleted && guestVisible(record, previousOwnerId)) : [];
      if (guestRecords.length === 0 || guestData.tombstone) {
        return 0;
      }

      // 2. Read destination records with ETag and perform OCC retry merge
      const isCloud = this.cloud ?? isR2Configured();
      const maxRetries = 5;
      let claimedCount = 0;
      let committed = false;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const destData = await this.readTenantDataWithEtag(ownerId, userKey);
        if (destData.tombstone) {
          throw new Error("Cannot migrate to a tombstoned/deleted tenant account");
        }
        const userRecords = Array.isArray(destData.records) ? [...destData.records] : [];
        const userExistingIds = new Set(userRecords.map((r) => r.id));

        const now = new Date().toISOString();
        claimedCount = 0;
        for (const record of guestRecords) {
          if (!userExistingIds.has(record.id)) {
            userRecords.push({
              ...record,
              ownerId,
              updatedAt: now,
            });
            userExistingIds.add(record.id);
            claimedCount++;
          }
        }

        // Commit updated user shard locally first
        await this.writeLocalTenant(userKey, userRecords);

        if (isCloud) {
          try {
            const success = await this.writeCloud(userKey, userRecords, destData.etag);
            if (!success) {
              // OCC conflict on destination shard! Wait and retry
              await new Promise((r) => setTimeout(r, 20 * Math.pow(2, attempt) + Math.random() * 20));
              continue;
            }
          } catch (err) {
            console.error(`Failed to write migrated shard to R2 for tenant ${userKey}:`, err?.message || err);
            throw err;
          }
        }

        if (this.redis?.isReady) {
          await this.redis.set(this.tenantRedisKey(ownerId), JSON.stringify(userRecords)).catch(() => {});
        }

        committed = true;
        break;
      }

      if (!committed) {
        const conflictErr = new Error(`Migration conflict: destination shard ${userKey} could not be updated after ${maxRetries} attempts`);
        conflictErr.code = "STORAGE_CONFLICT";
        conflictErr.statusCode = 409;
        throw conflictErr;
      }

      // 3. Purge/cleanup old guest shard ONLY after destination is confirmed written!
      // Check if parallel writes added new unmigrated records to guest shard
      const freshGuestData = await this.readTenantDataWithEtag(previousOwnerId, guestKey).catch(() => ({ records: [] }));
      const freshGuestRecords = Array.isArray(freshGuestData.records) ? freshGuestData.records : [];
      const migratedIds = new Set(guestRecords.map((r) => r.id));
      const unmigratedGuestRecords = freshGuestRecords.filter((r) => !migratedIds.has(r.id));

      if (unmigratedGuestRecords.length > 0) {
        // Parallel write added new records to guest shard: preserve unmigrated records!
        await this.writeLocalTenant(guestKey, unmigratedGuestRecords);
        if (isCloud) {
          await this.writeCloud(guestKey, unmigratedGuestRecords, freshGuestData.etag).catch(() => {});
        }
        if (this.redis?.isReady) {
          await this.redis.set(this.tenantRedisKey(previousOwnerId), JSON.stringify(unmigratedGuestRecords)).catch(() => {});
        }
      } else {
        // Safely remove guest shard
        await fs.rm(this.tenantFilePath(guestKey), { force: true }).catch(() => {});
        if (this.redis?.isReady) {
          await this.redis.del(this.tenantRedisKey(previousOwnerId)).catch(() => {});
        }
        if (isCloud) {
          await this.deleteCloud(guestKey).catch(() => {});
        }
      }

      return claimedCount;
    });
  }
}
