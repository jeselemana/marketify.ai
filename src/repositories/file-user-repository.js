import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { migrateAuthUserStore } from "./auth-store-migrations.js";
import { normalizeEmail, normalizeUsername } from "../auth/validation.js";

export class UserConflictError extends Error {
  constructor(field) {
    super(field === "email" ? "Bu e-poçt artıq istifadə olunur." : "Bu istifadəçi adı artıq götürülüb.");
    this.code = "USER_CONFLICT";
    this.field = field;
  }
}

export class FileUserRepository {
  constructor(filePath) {
    this.filePath = filePath;
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
    await this.ensure();
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return migrateAuthUserStore(JSON.parse(raw || "{}"));
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
    return String(identifier).includes("@")
      ? this.findByEmail(identifier)
      : this.findByUsername(identifier);
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
