import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { TenantLockManager } from "../repositories/tenant-lock.js";
import { writeJsonAtomically } from "../repositories/atomic-json-store.js";
import { isR2Configured, readTenantObject, writeTenantObject } from "./r2-storage.js";

// A lease must renew while work is running, and cancellation must propagate if it is lost.
export async function acquireIdempotencyLock({ ownerId, idempotencyKey, operation, redis, locksDir, timeoutMs = 120000, storage }) {
  const token = randomUUID();
  const identifier = `${ownerId}:${operation}:${idempotencyKey}`;
  const controller = new AbortController();
  let releaseBackend, renewBackend, readResult, saveResult;
  const resultTtl = 15 * 60 * 1000;
  const safeId = createHash("sha256").update(identifier).digest("hex");
  const loseLease = () => {
    const error = new Error("Execution lock was lost.");
    error.code = "EXECUTION_LOCK_LOST";
    error.status = 503;
    controller.abort(error);
  };

  if (redis?.isReady) {
    const key = `marketify:lock:strat:${identifier}`;
    if (!await redis.set(key, token, { NX: true, PX: timeoutMs })) return null;
    renewBackend = () => redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
      { keys: [key], arguments: [token, String(timeoutMs)] },
    );
    releaseBackend = () => redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      { keys: [key], arguments: [token] },
    );
    const resultKey = `marketify:result:strat:${safeId}`;
    readResult = async () => {
      const raw = await redis.get(resultKey);
      return raw ? JSON.parse(raw) : null;
    };
    saveResult = value => redis.set(resultKey, JSON.stringify({ ...value, expiresAt: Date.now() + resultTtl }), { PX: resultTtl });
  } else {
    const cloud = storage || (isR2Configured() ? { read: readTenantObject, write: writeTenantObject } : null);
    if (cloud) {
      const key = `strategy-locks-v1/${safeId}.json`;
      const current = await cloud.read(key);
      if (current.record?.token && current.record.expiresAt > Date.now()) return null;
      if (!await cloud.write(key, { token, expiresAt: Date.now() + timeoutMs }, current.etag)) return null;
      renewBackend = async () => {
        const fresh = await cloud.read(key);
        if (fresh.record?.token !== token || fresh.record.expiresAt <= Date.now()) return false;
        return cloud.write(key, { token, expiresAt: Date.now() + timeoutMs }, fresh.etag);
      };
      releaseBackend = async () => {
        const fresh = await cloud.read(key);
        if (fresh.record?.token === token) await cloud.write(key, { token: null, expiresAt: 0 }, fresh.etag);
      };
      const resultKey = `strategy-results-v1/${safeId}.json`;
      readResult = async () => (await cloud.read(resultKey)).record;
      saveResult = async value => {
        const current = await cloud.read(resultKey);
        if (!await cloud.write(resultKey, { ...value, expiresAt: Date.now() + resultTtl }, current.etag)) {
          loseLease();
          controller.signal.throwIfAborted();
        }
      };
    } else {
      const baseDir = locksDir || path.join(process.cwd(), "data", ".strategy-locks");
      const manager = new TenantLockManager(baseDir, { timeoutMs: 0, staleMs: timeoutMs });
      let lock;
      try { lock = await manager.acquire(safeId); }
      catch (error) { if (error.code === "STORAGE_BUSY") return null; throw error; }
      releaseBackend = lock.release;
      const resultPath = path.join(baseDir, `${safeId}.result.json`);
      readResult = async () => {
        try { return JSON.parse(await fs.readFile(resultPath, "utf8")); }
        catch (error) { if (error.code === "ENOENT") return null; throw error; }
      };
      saveResult = value => writeJsonAtomically(resultPath, { ...value, expiresAt: Date.now() + resultTtl });
    }
  }

  let renewal = Promise.resolve(), released = false, renewing = false;
  const renewLease = () => {
    if (renewing || released || controller.signal.aborted) return renewal;
    renewing = true;
    renewal = Promise.resolve().then(renewBackend).then(ok => {
      if (!ok) loseLease();
    }, loseLease).finally(() => { renewing = false; });
    return renewal;
  };
  const heartbeat = renewBackend ? setInterval(renewLease, Math.max(5, Math.floor(timeoutMs / 3))) : null;
  heartbeat?.unref();
  return {
    token,
    signal: controller.signal,
    assertOwned: async () => {
      if (released) loseLease();
      if (renewBackend) await renewLease();
      controller.signal.throwIfAborted();
    },
    readResult: async () => {
      const result = await readResult();
      return result?.expiresAt > Date.now() ? result : null;
    },
    saveResult: async value => {
      controller.signal.throwIfAborted();
      await saveResult(value);
      controller.signal.throwIfAborted();
    },
    release: async () => {
      if (released) return;
      released = true;
      clearInterval(heartbeat);
      await renewal;
      await releaseBackend();
    },
  };
}
