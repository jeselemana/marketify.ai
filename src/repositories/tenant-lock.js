import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

function ownerIsAlive(info) {
  if (!info?.pid || (info.hostname && info.hostname !== hostname())) return false;
  try {
    process.kill(info.pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

/**
 * Cross-instance and cross-process file-based lock for tenant mutations.
 * Provides safe release with token, crash recovery (stale detection),
 * timeout handling, and deterministic multi-tenant locking to prevent deadlocks.
 */

export class TenantLockManager {
  /**
   * @param {string} baseDir - Directory where .tenant-locks folder will be located
   * @param {object} [options]
   * @param {number} [options.timeoutMs=15000] - Timeout waiting for lock
   * @param {number} [options.staleMs=20000] - Duration after which an abandoned lock is broken
   */
  constructor(baseDir, options = {}) {
    this.baseDir = baseDir || path.join(process.cwd(), "data");
    this.locksDir = path.join(this.baseDir, ".tenant-locks");
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.staleMs = options.staleMs ?? 20000;
    this.inProcessQueues = new Map();
  }

  /**
   * Acquire a lock for a single tenantKey.
   * @param {string} tenantKey
   * @returns {Promise<{ token: string, release: () => Promise<void> }>}
   */
  async acquire(tenantKey) {
    await fs.mkdir(this.locksDir, { recursive: true }).catch(() => {});
    const lockDir = path.join(this.locksDir, `${tenantKey}.lock`);
    const ownerFile = path.join(lockDir, "owner.json");
    const token = randomUUID();
    const start = Date.now();

    while (true) {
      try {
        await fs.mkdir(lockDir);
        // Successfully created lock directory. Write owner info.
        const lockInfo = {
          token,
          pid: process.pid,
          hostname: hostname(),
          createdAt: Date.now(),
        };
        let handle;
        try {
          handle = await fs.open(ownerFile, "wx", 0o600);
          await handle.writeFile(JSON.stringify(lockInfo), "utf8");
        } catch (error) {
          await handle?.close();
          await fs.rm(lockDir, { recursive: true, force: true });
          throw error;
        }
        // Update the opened inode, never a replacement owner's lock file.
        const heartbeat = setInterval(() => {
          const now = new Date();
          handle.utimes(now, now).catch(() => {});
        }, Math.max(5, Math.floor(this.staleMs / 3)));
        heartbeat.unref();

        let released = false;
        const release = async () => {
          if (released) return;
          released = true;
          clearInterval(heartbeat);
          await handle.close();
          try {
            // Safe release: only delete if token matches
            const raw = await fs.readFile(ownerFile, "utf8").catch(() => null);
            if (raw) {
              const current = JSON.parse(raw);
              if (current.token === token) {
                await fs.rm(lockDir, { recursive: true, force: true }).catch(() => {});
              }
            }
          } catch {}
        };

        return { token, release };
      } catch (err) {
        if (err.code === "EEXIST") {
          // Lock exists. Check for stale lock (crash recovery)
          try {
            const stats = await fs.stat(lockDir);
            const raw = await fs.readFile(ownerFile, "utf8").catch(() => null);
            let updatedAt = stats.mtimeMs;
            let info = null;
            if (raw) {
              try {
                info = JSON.parse(raw);
                updatedAt = (await fs.stat(ownerFile)).mtimeMs;
              } catch {}
            }

            if (Date.now() - updatedAt > this.staleMs && !ownerIsAlive(info)) {
              // Stale lock detected, safely force remove
              await fs.rm(lockDir, { recursive: true, force: true }).catch(() => {});
              continue;
            }
          } catch {}

          if (Date.now() - start > this.timeoutMs) {
            const busyErr = new Error(`Tenant concurrency conflict: lock timeout for tenant ${tenantKey}`);
            busyErr.code = "STORAGE_BUSY";
            busyErr.statusCode = 503;
            throw busyErr;
          }

          // Backoff jitter: 15ms - 40ms
          await new Promise((resolve) => setTimeout(resolve, 15 + Math.floor(Math.random() * 25)));
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Run fn in a serialized in-process queue + cross-process file lock.
   * @param {string} tenantKey
   * @param {() => Promise<any>} fn
   * @returns {Promise<any>}
   */
  async runInLock(tenantKey, fn) {
    const previousQueue = this.inProcessQueues.get(tenantKey) || Promise.resolve();

    let releaseInProcess;
    const currentQueue = new Promise((resolve) => {
      releaseInProcess = resolve;
    });
    this.inProcessQueues.set(tenantKey, currentQueue);

    try {
      await previousQueue;
    } catch {
      // Ignore errors from earlier in-process operations
    }

    let fileLock = null;
    try {
      fileLock = await this.acquire(tenantKey);
      return await fn();
    } finally {
      if (fileLock) {
        await fileLock.release().catch(() => {});
      }
      releaseInProcess();
      if (this.inProcessQueues.get(tenantKey) === currentQueue) {
        this.inProcessQueues.delete(tenantKey);
      }
    }
  }

  /**
   * Run fn with locks on multiple tenant keys acquired in deterministic
   * lexicographical order to prevent deadlocks.
   * @param {string[]} tenantKeys
   * @param {() => Promise<any>} fn
   * @returns {Promise<any>}
   */
  async runInMultiLock(tenantKeys, fn) {
    const uniqueKeys = Array.from(new Set(tenantKeys)).sort();
    if (uniqueKeys.length === 0) return fn();
    if (uniqueKeys.length === 1) return this.runInLock(uniqueKeys[0], fn);

    const acquireNested = async (index) => {
      if (index >= uniqueKeys.length) {
        return fn();
      }
      return this.runInLock(uniqueKeys[index], () => acquireNested(index + 1));
    };

    return acquireNested(0);
  }
}
