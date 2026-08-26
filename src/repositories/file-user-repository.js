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
