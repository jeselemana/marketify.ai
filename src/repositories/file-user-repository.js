import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { migrateAuthUserStore } from "./auth-store-migrations.js";
import { normalizeEmail, normalizeUsername } from "../auth/validation.js";
import { loadJSONFromR2, saveJSONToR2 } from "../http/r2-storage.js";

export class UserConflictError extends Error {
  constructor(field) {
    super(field === "email" ? "Bu e-poçt artıq istifadə olunur." : "Bu istifadəçi adı artıq götürülüb.");
    this.code = "USER_CONFLICT";
    this.field = field;
  }
}

export class FileUserRepository {
  constructor(filePath, redis = null) {
    this.filePath = filePath;
    this.redis = redis;
    this.redisKey = "marketify:store:users";
    this.writeQueue = Promise.resolve();
  }

  async ensure() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.writeStore(migrateAuthUserStore(null));
    }
  }

  async readStore() {
    // 1. Try Cloudflare R2 first
    try {
      const r2Data = await loadJSONFromR2("users.json");
      if (r2Data && Array.isArray(r2Data.users) && r2Data.users.length > 0) {
        const store = migrateAuthUserStore(r2Data);
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
        await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
        await fs.rename(temporaryPath, this.filePath).catch(() => {});
        if (this.redis?.isReady) {
          await this.redis.set(this.redisKey, JSON.stringify(store)).catch(() => {});
        }
        return store;
      }
    } catch (err) {
      console.error("R2 user read error:", err?.message || err);
    }

    // 2. Try Redis
    if (this.redis?.isReady) {
      try {
        const raw = await this.redis.get(this.redisKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const store = migrateAuthUserStore(parsed);
          await fs.mkdir(path.dirname(this.filePath), { recursive: true });
          const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
          await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
          await fs.rename(temporaryPath, this.filePath).catch(() => {});
          await saveJSONToR2("users.json", store).catch(() => {});
          return store;
        }
      } catch (err) {
        console.error("Redis user read error:", err?.message || err);
      }
    }

    // 3. Try Local File
    await this.ensure();
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const store = migrateAuthUserStore(JSON.parse(raw || "{}"));
      if (store.users.length > 0) {
        if (this.redis?.isReady) {
          await this.redis.set(this.redisKey, JSON.stringify(store)).catch(() => {});
        }
        await saveJSONToR2("users.json", store).catch(() => {});
      }
      return store;
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("User storage contains invalid JSON.");
      throw error;
    }
  }

  async writeStore(store) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, this.filePath);

    if (this.redis?.isReady) {
      try {
        await this.redis.set(this.redisKey, JSON.stringify(store));
      } catch (err) {
        console.error("Redis user write error:", err?.message || err);
      }
    }

    await saveJSONToR2("users.json", store).catch(() => {});
  }

  enqueue(operation) {
    this.writeQueue = this.writeQueue.then(operation, operation);
    return this.writeQueue;
  }

  async findById(id) {
    const { users } = await this.readStore();
    return users.find((user) => user.id === id) || null;
  }

  async findByUsername(username) {
    const normalized = normalizeUsername(username);
    const { users } = await this.readStore();
    return users.find((user) => user.username === normalized) || null;
  }

  async findByEmail(email) {
    const normalized = normalizeEmail(email);
    const { users } = await this.readStore();
    return users.find((user) => user.email === normalized) || null;
  }

  async findByIdentifier(identifier) {
    const raw = String(identifier || "").trim();
    if (!raw) return null;
    // Treat leading @ as a username (UI shows @username)
    if (raw.startsWith("@")) {
      return this.findByUsername(raw.slice(1));
    }
    // If it looks like an email, try email first, then fall back to username
    if (raw.includes("@")) {
      const byEmail = await this.findByEmail(raw);
      if (byEmail) return byEmail;
    }
    return this.findByUsername(raw);
  }

  create(payload) {
    return this.enqueue(async () => {
      const store = await this.readStore();
      const username = normalizeUsername(payload.username);
      const email = normalizeEmail(payload.email);
      if (store.users.some((user) => user.username === username)) throw new UserConflictError("username");
      if (store.users.some((user) => user.email === email)) throw new UserConflictError("email");
      const now = new Date().toISOString();
      const user = {
        id: `usr_${randomUUID()}`,
        fullName: payload.fullName.trim(),
        username,
        email,
        passwordHash: payload.passwordHash,
        avatarUrl: null,
        emailVerifiedAt: null,
        onboardingFocus: null,
        onboardingCompletedAt: null,
        passwordChangedAt: now,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      };
      store.users.push(user);
      await this.writeStore(store);
      return user;
    });
  }

  update(id, changes) {
    return this.enqueue(async () => {
      const store = await this.readStore();
      const index = store.users.findIndex((user) => user.id === id);
      if (index === -1) return null;
      const username = changes.username ? normalizeUsername(changes.username) : store.users[index].username;
      const email = changes.email ? normalizeEmail(changes.email) : store.users[index].email;
      if (store.users.some((user, i) => i !== index && user.username === username)) throw new UserConflictError("username");
      if (store.users.some((user, i) => i !== index && user.email === email)) throw new UserConflictError("email");
      store.users[index] = {
        ...store.users[index],
        ...changes,
        username,
        email,
        updatedAt: new Date().toISOString(),
      };
      await this.writeStore(store);
      return store.users[index];
    });
  }

  updatePassword(id, passwordHash) {
    const now = new Date().toISOString();
    return this.update(id, { passwordHash, passwordChangedAt: now });
  }

  markLogin(id) {
    return this.update(id, { lastLoginAt: new Date().toISOString() });
  }
}
