import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadJSONFromR2, saveJSONToR2 } from "../http/r2-storage.js";

export class FileStrategyRepository {
  constructor(filePath, redis = null) {
    this.filePath = filePath;
    this.redis = redis;
    this.redisKey = "marketify:store:strategies";
    this.writeQueue = Promise.resolve();
  }

  async ensure() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "[]\n", "utf8");
    }
  }

  async readAll() {
    // 1. Try Cloudflare R2 first
    try {
      const r2Data = await loadJSONFromR2("strategies.json");
      if (r2Data && Array.isArray(r2Data) && r2Data.length > 0) {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
        await fs.writeFile(temporaryPath, `${JSON.stringify(r2Data, null, 2)}\n`, "utf8");
        await fs.rename(temporaryPath, this.filePath).catch(() => {});
        if (this.redis?.isReady) {
          await this.redis.set(this.redisKey, JSON.stringify(r2Data)).catch(() => {});
        }
        return r2Data;
      }
    } catch (err) {
      console.error("R2 strategy read error:", err?.message || err);
    }

    // 2. Try Redis
    if (this.redis?.isReady) {
      try {
        const raw = await this.redis.get(this.redisKey);
        if (raw) {
          const data = JSON.parse(raw);
          const records = Array.isArray(data) ? data : [];
          await fs.mkdir(path.dirname(this.filePath), { recursive: true });
          const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
          await fs.writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
          await fs.rename(temporaryPath, this.filePath).catch(() => {});
          await saveJSONToR2("strategies.json", records).catch(() => {});
          return records;
        }
      } catch (err) {
        console.error("Redis strategy read error:", err?.message || err);
      }
    }

    // 3. Try Local File
    await this.ensure();
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const data = JSON.parse(raw || "[]");
      const records = Array.isArray(data) ? data : [];
      if (records.length > 0) {
        if (this.redis?.isReady) {
          await this.redis.set(this.redisKey, JSON.stringify(records)).catch(() => {});
        }
        await saveJSONToR2("strategies.json", records).catch(() => {});
      }
      return records;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error("Strategy storage contains invalid JSON.");
        return [];
      }
      throw error;
    }
  }

  async writeAll(records) {
    const operation = async () => {
      await this.ensure();
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
      await fs.rename(temporaryPath, this.filePath);

      if (this.redis?.isReady) {
        try {
          await this.redis.set(this.redisKey, JSON.stringify(records));
        } catch (err) {
          console.error("Redis strategy write error:", err?.message || err);
        }
      }

      await saveJSONToR2("strategies.json", records).catch(() => {});
    };
    this.writeQueue = this.writeQueue.then(operation, operation);
    return this.writeQueue;
  }

  async list(ownerId) {
    const records = await this.readAll();
    return records
      .filter((record) => record.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ versions, ownerId: _ownerId, clientSaveId: _clientSaveId, ...record }) => ({
        ...record,
        versionCount: versions.length,
      }));
  }

  async getById(id, ownerId) {
    const records = await this.readAll();
    return records.find((record) => record.id === id && record.ownerId === ownerId) || null;
  }

  async create(payload, ownerId) {
    const records = await this.readAll();
    const duplicate = records.find(
      (record) => record.ownerId === ownerId && record.clientSaveId === payload.clientSaveId,
    );
    if (duplicate) return duplicate;

    const now = new Date().toISOString();
    const versions = payload.versions.map((version) => ({
      ...version,
      id: randomUUID(),
    }));
    const record = {
      id: randomUUID(),
      ownerId,
      clientSaveId: payload.clientSaveId,
      title: payload.strategy.title,
      brief: payload.brief,
      clarification: { answers: payload.answers },
      strategy: payload.strategy,
      status: "saved",
      currentVersionId: versions.at(-1).id,
      learningInteractionId: payload.learningInteractionId || null,
      versions,
      createdAt: now,
      updatedAt: now,
    };
    records.push(record);
    await this.writeAll(records);
    return record;
  }

  async appendVersion(id, ownerId, strategy, changeRequest) {
    const records = await this.readAll();
    const index = records.findIndex((record) => record.id === id && record.ownerId === ownerId);
    if (index === -1) return null;

    const record = records[index];
    const version = {
      id: randomUUID(),
      versionNumber: record.versions.length + 1,
      data: strategy,
      changeRequest,
      createdAt: new Date().toISOString(),
    };
    records[index] = {
      ...record,
      title: strategy.title,
      strategy,
      status: "saved",
      currentVersionId: version.id,
      versions: [...record.versions, version],
      updatedAt: version.createdAt,
    };
    await this.writeAll(records);
    return records[index];
  }

  async claimOwner(previousOwnerId, ownerId) {
    if (!previousOwnerId || previousOwnerId === ownerId) return 0;
    const records = await this.readAll();
    let claimed = 0;
    const migrated = records.map((record) => {
      if (record.ownerId !== previousOwnerId) return record;
      claimed += 1;
      return { ...record, ownerId, updatedAt: new Date().toISOString() };
    });
    if (claimed) await this.writeAll(migrated);
    return claimed;
  }

  async delete(id, ownerId) {
    if (!id || !ownerId) return false;
    const records = await this.readAll();
    const remaining = records.filter((record) => !(record.id === id && record.ownerId === ownerId));
    if (remaining.length === records.length) return false;
    await this.writeAll(remaining);
    return true;
  }

  async updateTitle(id, ownerId, title) {
    if (!id || !ownerId || !title?.trim()) return null;
    const records = await this.readAll();
    const index = records.findIndex((record) => record.id === id && record.ownerId === ownerId);
    if (index === -1) return null;

    const trimmedTitle = title.trim();
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

    await this.writeAll(records);
    return records[index];
  }

  async duplicate(id, ownerId) {
    if (!id || !ownerId) return null;
    const records = await this.readAll();
    const original = records.find((record) => record.id === id && record.ownerId === ownerId);
    if (!original) return null;

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
    await this.writeAll(records);
    return duplicateRecord;
  }

  async deleteAllByOwner(ownerId) {
    if (!ownerId) return 0;
    const records = await this.readAll();
    const remaining = records.filter((record) => record.ownerId !== ownerId);
    const removedCount = records.length - remaining.length;
    if (removedCount > 0) {
      await this.writeAll(remaining);
    }
    return removedCount;
  }
}
