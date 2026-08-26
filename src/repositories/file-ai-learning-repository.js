import fs from "node:fs/promises";
import path from "node:path";
import { loadJSONFromR2, saveJSONToR2 } from "../http/r2-storage.js";

export const EMPTY_LEARNING_STORE = Object.freeze({
  schemaVersion: 1,
  interactions: [],
  signals: [],
  iterations: [],
  candidates: [],
});

function normalizeStore(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    schemaVersion: 1,
    interactions: Array.isArray(source.interactions) ? source.interactions : [],
    signals: Array.isArray(source.signals) ? source.signals : [],
    iterations: Array.isArray(source.iterations) ? source.iterations : [],
    candidates: Array.isArray(source.candidates) ? source.candidates : [],
  };
}

export class FileAiLearningRepository {
  constructor(filePath, redis = null, { mirrorToR2 = true } = {}) {
    this.filePath = filePath;
    this.redis = redis;
    this.redisKey = "marketify:store:ai-learning:v1";
    this.r2FileName = "ai-learning-v1.json";
    this.mirrorToR2 = mirrorToR2;
    this.writeQueue = Promise.resolve();
  }

  async ensure() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try { await fs.access(this.filePath); }
    catch { await fs.writeFile(this.filePath, `${JSON.stringify(EMPTY_LEARNING_STORE, null, 2)}\n`, "utf8"); }
  }

  async readStore() {
    if (this.redis?.isReady) {
      try {
        const cached = await this.redis.get(this.redisKey);
        if (cached) return normalizeStore(JSON.parse(cached));
      } catch (error) { console.error("AI learning Redis read error:", error.message); }
    }
    if (this.mirrorToR2) {
      try {
        const remote = await loadJSONFromR2(this.r2FileName, null);
        if (remote?.schemaVersion) return normalizeStore(remote);
      } catch (error) { console.error("AI learning R2 read error:", error.message); }
    }
    await this.ensure();
    try { return normalizeStore(JSON.parse(await fs.readFile(this.filePath, "utf8"))); }
    catch (error) {
      if (error instanceof SyntaxError) return normalizeStore(null);
      throw error;
    }
  }

  async writeStore(store) {
    const normalized = normalizeStore(store);
    const operation = async () => {
      await this.ensure();
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
      await fs.rename(temporaryPath, this.filePath);
      if (this.redis?.isReady) await this.redis.set(this.redisKey, JSON.stringify(normalized)).catch((error) => console.error("AI learning Redis write error:", error.message));
      if (this.mirrorToR2) await saveJSONToR2(this.r2FileName, normalized).catch((error) => console.error("AI learning R2 write error:", error.message));
      return normalized;
    };
    this.writeQueue = this.writeQueue.then(operation, operation);
    return this.writeQueue;
  }

  async update(mutator) {
    let result;
    const operation = async () => {
      const store = await this.readStore();
      result = await mutator(store);
      await this.ensure();
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
      await fs.rename(temporaryPath, this.filePath);
      if (this.redis?.isReady) await this.redis.set(this.redisKey, JSON.stringify(store)).catch(() => {});
      if (this.mirrorToR2) await saveJSONToR2(this.r2FileName, store).catch(() => {});
    };
    this.writeQueue = this.writeQueue.then(operation, operation);
    await this.writeQueue;
    return result;
  }

  async deleteAllByOwner(ownerId) {
    if (!ownerId) return 0;
    return this.update((store) => {
      const ids = new Set(store.interactions.filter((item) => item.ownerId === ownerId).map((item) => item.id));
      store.interactions = store.interactions.filter((item) => !ids.has(item.id));
      store.signals = store.signals.filter((item) => !ids.has(item.interactionId));
      store.iterations = store.iterations.filter((item) => !ids.has(item.parentInteractionId));
      store.candidates = store.candidates.filter((item) => !ids.has(item.sourceInteractionId));
      return ids.size;
    });
  }

  async claimOwner(previousOwnerId, ownerId) {
    if (!previousOwnerId || previousOwnerId === ownerId) return 0;
    return this.update((store) => {
      let count = 0;
      for (const interaction of store.interactions) {
        if (interaction.ownerId === previousOwnerId) {
          interaction.ownerId = ownerId;
          count += 1;
        }
      }
      return count;
    });
  }
}
