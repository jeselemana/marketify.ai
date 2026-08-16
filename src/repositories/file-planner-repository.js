import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadJSONFromR2, saveJSONToR2 } from "../http/r2-storage.js";

export class FilePlannerRepository {
  constructor(filePath, redis = null) {
    this.filePath = filePath;
    this.redis = redis;
    this.redisKey = "marketify:store:planner";
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
    // 1. Cloudflare R2
    try {
      const r2Data = await loadJSONFromR2("planner.json");
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
      console.error("R2 planner read error:", err?.message || err);
    }

    // 2. Redis
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
          await saveJSONToR2("planner.json", records).catch(() => {});
          return records;
        }
      } catch (err) {
        console.error("Redis planner read error:", err?.message || err);
      }
    }

    // 3. Local disk
    await this.ensure();
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const data = JSON.parse(raw || "[]");
      const records = Array.isArray(data) ? data : [];
      if (records.length > 0) {
        if (this.redis?.isReady) {
          await this.redis.set(this.redisKey, JSON.stringify(records)).catch(() => {});
        }
        await saveJSONToR2("planner.json", records).catch(() => {});
      }
      return records;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error("Planner storage contains invalid JSON.");
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
          console.error("Redis planner write error:", err?.message || err);
        }
      }

      await saveJSONToR2("planner.json", records).catch(() => {});
    };
    this.writeQueue = this.writeQueue.then(operation, operation);
    return this.writeQueue;
  }

  async list(ownerId) {
    const records = await this.readAll();
    return records
      .filter((task) => task.ownerId === ownerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async addBatch(ownerId, tasks = []) {
    const records = await this.readAll();
    const now = new Date().toISOString();
    const added = [];

    for (const item of tasks) {
      const text = typeof item === "string" ? item.trim() : String(item.text || "").trim();
      if (!text) continue;

      const groupLabel = item.groupLabel || "Ümumi";
      const strategyId = item.strategyId || null;
      const strategyTitle = item.strategyTitle || null;

      // Prevent duplicate task from same strategy with exact same text
      const isDuplicate = records.some(
        (r) =>
          r.ownerId === ownerId &&
          r.text.toLowerCase() === text.toLowerCase() &&
          r.strategyId === strategyId
      );

      if (!isDuplicate) {
        const newTask = {
          id: randomUUID(),
          ownerId,
          text,
          groupLabel,
          strategyId,
          strategyTitle,
          completed: false,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        records.unshift(newTask);
        added.push(newTask);
      }
    }

    if (added.length > 0) {
      await this.writeAll(records);
    }
    return added;
  }

  async update(id, ownerId, changes = {}) {
    const records = await this.readAll();
    const index = records.findIndex((r) => r.id === id && r.ownerId === ownerId);
    if (index === -1) return null;

    const now = new Date().toISOString();
    records[index] = {
      ...records[index],
      ...changes,
      completed: typeof changes.completed === "boolean" ? changes.completed : records[index].completed,
      completedAt: changes.completed ? (records[index].completedAt || now) : null,
      updatedAt: now,
    };

    await this.writeAll(records);
    return records[index];
  }

  async delete(id, ownerId) {
    const records = await this.readAll();
    const filtered = records.filter((r) => !(r.id === id && r.ownerId === ownerId));
    if (filtered.length !== records.length) {
      await this.writeAll(filtered);
      return true;
    }
    return false;
  }

  async clearCompleted(ownerId) {
    const records = await this.readAll();
    const filtered = records.filter((r) => !(r.ownerId === ownerId && r.completed));
    const count = records.length - filtered.length;
    if (count > 0) {
      await this.writeAll(filtered);
    }
    return count;
  }

  async claimOwner(previousOwnerId, ownerId) {
    if (!previousOwnerId || previousOwnerId === ownerId) return 0;
    const records = await this.readAll();
    let count = 0;
    for (const record of records) {
      if (record.ownerId === previousOwnerId) {
        record.ownerId = ownerId;
        count += 1;
      }
    }
    if (count > 0) {
      await this.writeAll(records);
    }
    return count;
  }
}
