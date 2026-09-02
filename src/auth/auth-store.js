import fs from "node:fs/promises";
import path from "node:path";
import { loadJSONFromR2, saveJSONToR2 } from "../http/r2-storage.js";

function emptyStore() {
  return { schemaVersion: 1, sessions: {}, resetTokens: {}, emailVerificationTokens: {}, rates: {} };
}

export class FileAuthStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
    this.cache = null;
    this.lastR2Sync = 0;
    this.syncPromise = null;
  }

  async syncFromR2(force = false) {
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = (async () => {
      let localStore = null;
      try {
        const raw = await fs.readFile(this.filePath, "utf8");
        localStore = JSON.parse(raw || "{}");
      } catch {}

      try {
        const r2Data = await loadJSONFromR2("auth-store.json");
        if (r2Data && typeof r2Data === "object") {
          const localSessions = localStore?.sessions || {};
          const r2Sessions = r2Data.sessions || {};
          const mergedSessions = { ...r2Sessions, ...localSessions };
          const now = Date.now();
          for (const [key, value] of Object.entries(mergedSessions)) {
            if (value.expiresAt <= now) delete mergedSessions[key];
          }

          const merged = {
            ...emptyStore(),
            ...r2Data,
            ...(localStore || {}),
            sessions: mergedSessions,
          };

          await fs.mkdir(path.dirname(this.filePath), { recursive: true });
          const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
          await fs.writeFile(temporaryPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
          await fs.rename(temporaryPath, this.filePath).catch(() => {});

          this.cache = merged;
          this.lastR2Sync = Date.now();

          // Əgər lokalda R2-dən fərqli sessiya varsa, R2-yə də yaz
          if (Object.keys(localSessions).length > 0 && Object.keys(mergedSessions).length > Object.keys(r2Sessions).length) {
            saveJSONToR2("auth-store.json", merged).catch(() => {});
          }

          return merged;
        }
      } catch (err) {
        console.error("R2 auth-store sync error:", err?.message || err);
      }

      if (localStore) {
        this.cache = { ...emptyStore(), ...localStore };
        return this.cache;
      }
      return this.cache || emptyStore();
    })();

    try {
      return await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  async read() {
    if (this.cache) return this.cache;

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw || "{}");
      this.cache = { ...emptyStore(), ...parsed };
      return this.cache;
    } catch (error) {
      if (error.code === "ENOENT") {
        return await this.syncFromR2(true);
      }
      throw error;
    }
  }

  async write(store) {
    this.cache = store;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, this.filePath);
    await saveJSONToR2("auth-store.json", store).catch((err) => {
      console.error("⚠️ Failed to save auth-store to R2:", err?.message || err);
    });
  }

  mutate(callback) {
    const operation = async () => {
      const store = await this.read();
      const now = Date.now();
      for (const [key, value] of Object.entries(store.sessions)) {
        if (value.expiresAt <= now) delete store.sessions[key];
      }
      for (const [key, value] of Object.entries(store.resetTokens)) {
        if (value.expiresAt <= now) delete store.resetTokens[key];
      }
      for (const [key, value] of Object.entries(store.emailVerificationTokens)) {
        if (value.expiresAt <= now) delete store.emailVerificationTokens[key];
      }
      for (const [key, value] of Object.entries(store.rates)) {
        if (value.resetAt <= now) delete store.rates[key];
      }
      const result = callback(store, now);
      await this.write(store);
      return result;
    };
    this.queue = this.queue.then(operation, operation);
    return this.queue;
  }

  async createSession(id, userId, ttlSeconds) {
    return this.mutate((store, now) => {
      store.sessions[id] = { userId, createdAt: now, expiresAt: now + ttlSeconds * 1000 };
    });
  }

  async getSession(id) {
    const store = await this.read();
    let session = store.sessions[id];
    if (session && session.expiresAt > Date.now()) return session;

    // Əgər lokal keşdə tapılmadısa və R2 aktivdirsə, R2-dən yeniləməyi yoxla
    if (Date.now() - this.lastR2Sync > 15000) {
      const freshStore = await this.syncFromR2(true);
      session = freshStore.sessions[id];
      if (session && session.expiresAt > Date.now()) return session;
    }
    return null;
  }

  async deleteSession(id) {
    return this.mutate((store) => delete store.sessions[id]);
  }

  async invalidateUserSessions(userId, exceptId = null) {
    return this.mutate((store) => {
      for (const [id, session] of Object.entries(store.sessions)) {
        if (session.userId === userId && id !== exceptId) delete store.sessions[id];
      }
    });
  }

  async createResetToken(id, userId, ttlSeconds) {
    return this.mutate((store, now) => {
      store.resetTokens[id] = { userId, createdAt: now, expiresAt: now + ttlSeconds * 1000 };
    });
  }

  async consumeResetToken(id) {
    return this.mutate((store) => {
      const token = store.resetTokens[id] || null;
      delete store.resetTokens[id];
      return token;
    });
  }

  async createEmailVerificationToken(id, userId, ttlSeconds) {
    return this.mutate((store, now) => {
      store.emailVerificationTokens[id] = { userId, createdAt: now, expiresAt: now + ttlSeconds * 1000 };
    });
  }

  async consumeEmailVerificationToken(id) {
    return this.mutate((store) => {
      const token = store.emailVerificationTokens[id] || null;
      delete store.emailVerificationTokens[id];
      return token;
    });
  }

  async hitRateLimit(key, limit, windowSeconds) {
    return this.mutate((store, now) => {
      const existing = store.rates[key];
      const rate = !existing || existing.resetAt <= now
        ? { count: 0, resetAt: now + windowSeconds * 1000 }
        : existing;
      rate.count += 1;
      store.rates[key] = rate;
      return { allowed: rate.count <= limit, remaining: Math.max(0, limit - rate.count), resetAt: rate.resetAt };
    });
  }
}

export class RedisAuthStore {
  constructor(client) {
    this.client = client;
  }

  sessionKey(id) { return `auth:session:${id}`; }
  userSessionsKey(userId) { return `auth:user-sessions:${userId}`; }

  async createSession(id, userId, ttlSeconds) {
    await this.client.multi()
      .set(this.sessionKey(id), JSON.stringify({ userId, createdAt: Date.now() }), { EX: ttlSeconds })
      .sAdd(this.userSessionsKey(userId), id)
      .expire(this.userSessionsKey(userId), ttlSeconds)
      .exec();
  }

  async getSession(id) {
    const value = await this.client.get(this.sessionKey(id));
    return value ? JSON.parse(value) : null;
  }

  async deleteSession(id) {
    const session = await this.getSession(id);
    await this.client.del(this.sessionKey(id));
    if (session?.userId) await this.client.sRem(this.userSessionsKey(session.userId), id);
  }

  async invalidateUserSessions(userId, exceptId = null) {
    const ids = await this.client.sMembers(this.userSessionsKey(userId));
    const deletions = ids.filter((id) => id !== exceptId);
    if (deletions.length) await this.client.del(deletions.map((id) => this.sessionKey(id)));
    await this.client.del(this.userSessionsKey(userId));
    if (exceptId) {
      const ttl = await this.client.ttl(this.sessionKey(exceptId));
      if (ttl > 0) {
        await this.client.sAdd(this.userSessionsKey(userId), exceptId);
        await this.client.expire(this.userSessionsKey(userId), ttl);
      }
    }
  }

  async createResetToken(id, userId, ttlSeconds) {
    await this.client.set(`auth:reset:${id}`, JSON.stringify({ userId }), { EX: ttlSeconds });
  }

  async consumeResetToken(id) {
    const key = `auth:reset:${id}`;
    const value = typeof this.client.getDel === "function"
      ? await this.client.getDel(key)
      : await this.client.get(key);
    if (value && typeof this.client.getDel !== "function") await this.client.del(key);
    return value ? JSON.parse(value) : null;
  }

  async createEmailVerificationToken(id, userId, ttlSeconds) {
    await this.client.set(`auth:verify-email:${id}`, JSON.stringify({ userId }), { EX: ttlSeconds });
  }

  async consumeEmailVerificationToken(id) {
    const key = `auth:verify-email:${id}`;
    const value = typeof this.client.getDel === "function"
      ? await this.client.getDel(key)
      : await this.client.get(key);
    if (value && typeof this.client.getDel !== "function") await this.client.del(key);
    return value ? JSON.parse(value) : null;
  }

  async hitRateLimit(key, limit, windowSeconds) {
    const redisKey = `auth:rate:${key}`;
    const count = await this.client.incr(redisKey);
    if (count === 1) await this.client.expire(redisKey, windowSeconds);
    const ttl = Math.max(0, await this.client.ttl(redisKey));
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: Date.now() + ttl * 1000 };
  }
}
