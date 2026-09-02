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
    this.cache = null;
    this.lastR2Sync = 0;
    this.syncPromise = null;
  }

  async ensure() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.writeStore(migrateAuthUserStore(null));
    }
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
        const r2Data = await loadJSONFromR2("users.json");
        const userMap = new Map();

        // 1. R2-dən gələn istifadəçilər
        if (r2Data && Array.isArray(r2Data.users)) {
          for (const u of r2Data.users) {
            if (u?.id) userMap.set(u.id, u);
          }
        }

        // 2. Lokal diskdəki istifadəçilərlə birləşdirmək (merge)
        if (localStore && Array.isArray(localStore.users)) {
          for (const lu of localStore.users) {
            if (!lu?.id) continue;
            const existing = userMap.get(lu.id);
            if (!existing) {
              userMap.set(lu.id, lu);
            } else {
              const luTime = new Date(lu.updatedAt || lu.createdAt || 0).getTime();
              const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              userMap.set(lu.id, luTime >= exTime ? { ...existing, ...lu } : { ...lu, ...existing });
            }
          }
        }

        if (userMap.size > 0) {
          const mergedUsers = Array.from(userMap.values());
          const store = migrateAuthUserStore({ schemaVersion: 2, users: mergedUsers });

          await fs.mkdir(path.dirname(this.filePath), { recursive: true });
          const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
          await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
          await fs.rename(temporaryPath, this.filePath).catch(() => {});

          this.cache = store;
          this.lastR2Sync = Date.now();

          if (this.redis?.isReady) {
            await this.redis.set(this.redisKey, JSON.stringify(store)).catch(() => {});
          }

          if (r2Data?.users && mergedUsers.length > r2Data.users.length) {
            saveJSONToR2("users.json", store).catch(() => {});
          }

          return store;
        }
      } catch (err) {
        console.error("R2 user sync error:", err?.message || err);
      }

      if (localStore && Array.isArray(localStore.users)) {
        this.cache = migrateAuthUserStore(localStore);
        return this.cache;
      }

      return this.cache || migrateAuthUserStore(null);
    })();

    try {
      return await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  async readStore() {
    if (this.cache) return this.cache;

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const store = migrateAuthUserStore(JSON.parse(raw || "{}"));
      this.cache = store;
      return store;
    } catch (error) {
      if (error.code === "ENOENT") {
        return await this.syncFromR2(true);
      }
      if (error instanceof SyntaxError) throw new Error("User storage contains invalid JSON.");
      throw error;
    }
  }

  async writeStore(store) {
    this.cache = store;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, this.filePath);

    if (this.redis?.isReady) {
      try {
        await this.redis.set(this.redisKey, JSON.stringify(store));
      } catch (err) {
        console.error("Redis user write error:", err?.message || err);
      }
    }

    await saveJSONToR2("users.json", store).catch((err) => {
      console.error("⚠️ Failed to save users to R2:", err?.message || err);
    });
  }

  enqueue(operation) {
    this.writeQueue = this.writeQueue.then(operation, operation);
    return this.writeQueue;
  }

  async findById(id) {
    const { users } = await this.readStore();
    let user = users.find((item) => item.id === id);
    if (!user && Date.now() - this.lastR2Sync > 15000) {
      const freshStore = await this.syncFromR2(true);
      user = freshStore.users?.find((item) => item.id === id) || null;
    }
    return user || null;
  }

  async findByUsername(username) {
    const normalized = normalizeUsername(username).replace(/^@+/, "");
    if (!normalized) return null;
    const { users } = await this.readStore();
    return users.find((user) => normalizeUsername(user.username).replace(/^@+/, "") === normalized) || null;
  }

  async findByEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const { users } = await this.readStore();
    return users.find((user) => normalizeEmail(user.email) === normalized) || null;
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

  async findUniqueUsername(desiredUsername) {
    const clean = normalizeUsername(desiredUsername)
      .replace(/^@+/, "")
      .replace(/[^a-z0-9._]/g, "")
      .replace(/^[._]+|[._]+$/g, "");
    const base = clean.length >= 3 ? clean.slice(0, 24) : `user${Math.floor(1000 + Math.random() * 9000)}`;

    const { users } = await this.readStore();
    const existingSet = new Set(users.map((u) => normalizeUsername(u.username).replace(/^@+/, "")));

    if (!existingSet.has(base)) {
      return base;
    }

    let counter = 1;
    while (counter < 1000) {
      const candidate = `${base.slice(0, 24)}${counter}`;
      if (!existingSet.has(candidate)) {
        return candidate;
      }
      counter += 1;
    }
    return `${base.slice(0, 18)}_${Date.now().toString().slice(-6)}`;
  }

  create(payload) {
    return this.enqueue(async () => {
      const store = await this.readStore();
      const username = normalizeUsername(payload.username).replace(/^@+/, "");
      const email = normalizeEmail(payload.email);
      if (store.users.some((user) => normalizeUsername(user.username).replace(/^@+/, "") === username)) {
        throw new UserConflictError("username");
      }
      if (store.users.some((user) => normalizeEmail(user.email) === email)) {
        throw new UserConflictError("email");
      }
      const now = new Date().toISOString();
      const user = {
        id: `usr_${randomUUID()}`,
        fullName: payload.fullName.trim(),
        username,
        email,
        passwordHash: payload.passwordHash,
        avatarUrl: payload.avatarUrl || null,
        emailVerifiedAt: payload.emailVerifiedAt || null,
        onboardingFocus: payload.onboardingFocus || null,
        onboardingCompletedAt: payload.onboardingCompletedAt || null,
        settings: {
          personalIntelligence: false,
          brandName: "",
          industry: "",
          targetAudience: "",
          primaryMarket: "",
          tone: "professional",
          customInstructions: "",
          memories: [],
          autoContext: true,
          strategyPersonalization: true,
          defaultMode: "build",
          language: "az",
        },
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
      const username = changes.username ? normalizeUsername(changes.username).replace(/^@+/, "") : normalizeUsername(store.users[index].username).replace(/^@+/, "");
      const email = changes.email ? normalizeEmail(changes.email) : normalizeEmail(store.users[index].email);
      if (store.users.some((user, i) => i !== index && normalizeUsername(user.username).replace(/^@+/, "") === username)) {
        throw new UserConflictError("username");
      }
      if (store.users.some((user, i) => i !== index && normalizeEmail(user.email) === email)) {
        throw new UserConflictError("email");
      }
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

  scheduleDeletion(id, days = 14) {
    const now = new Date();
    const scheduled = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return this.update(id, {
      status: "pending_deletion",
      deletionRequestedAt: now.toISOString(),
      scheduledDeletionAt: scheduled.toISOString(),
    });
  }

  cancelDeletion(id) {
    return this.update(id, {
      status: "active",
      deletionRequestedAt: null,
      scheduledDeletionAt: null,
    });
  }

  deleteUser(id) {
    return this.enqueue(async () => {
      const store = await this.readStore();
      const initialLength = store.users.length;
      store.users = store.users.filter((user) => user.id !== id);
      if (store.users.length !== initialLength) {
        await this.writeStore(store);
        return true;
      }
      return false;
    });
  }

  async purgeExpiredAccounts({ strategyRepository = null, chatRepository = null, plannerRepository = null, aiLearningRepository = null, authStore = null } = {}) {
    return this.enqueue(async () => {
      const store = await this.readStore();
      const now = new Date();
      const expiredUsers = store.users.filter((user) => {
        if (user.scheduledDeletionAt) {
          const sched = new Date(user.scheduledDeletionAt);
          if (!isNaN(sched.getTime()) && sched <= now) return true;
        }

        // Signup hesabı 24 saat ərzində e-poçtla təsdiqlənməzsə,
        // yarımçıq qeydiyyat məlumatını saxlamırıq.
        if (user.emailVerifiedAt) return false;
        const createdAt = new Date(user.createdAt);
        const unverifiedExpiry = now.getTime() - 24 * 60 * 60 * 1000;
        return !isNaN(createdAt.getTime()) && createdAt.getTime() <= unverifiedExpiry;
      });

      if (expiredUsers.length === 0) return 0;

      const expiredIds = new Set(expiredUsers.map((u) => u.id));

      for (const userId of expiredIds) {
        try {
          if (strategyRepository?.deleteAllByOwner) await strategyRepository.deleteAllByOwner(userId);
          if (chatRepository?.deleteAllByOwner) await chatRepository.deleteAllByOwner(userId);
          if (plannerRepository?.deleteAllByOwner) await plannerRepository.deleteAllByOwner(userId);
          if (aiLearningRepository?.deleteAllByOwner) await aiLearningRepository.deleteAllByOwner(userId);
        } catch (err) {
          console.error(`Error cascading data deletion for expired user ${userId}:`, err);
        }
      }

      store.users = store.users.filter((user) => !expiredIds.has(user.id));
      await this.writeStore(store);
      return expiredUsers.length;
    });
  }
}
