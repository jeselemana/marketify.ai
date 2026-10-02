import { AtomicJsonStore, storageCorruption } from "./atomic-json-store.js";

export const EMPTY_LEARNING_STORE = Object.freeze({
  schemaVersion: 1,
  interactions: [],
  signals: [],
  iterations: [],
  candidates: [],
});

function normalizeStore(value) {
  const source = value && typeof value === "object" ? value : {};
  for (const key of ["interactions", "signals", "iterations", "candidates"]) {
    if (source[key] !== undefined && !Array.isArray(source[key])) throw storageCorruption(`Invalid learning ${key}.`);
  }
  return {
    schemaVersion: 1,
    interactions: Array.isArray(source.interactions) ? source.interactions : [],
    signals: Array.isArray(source.signals) ? source.signals : [],
    iterations: Array.isArray(source.iterations) ? source.iterations : [],
    candidates: Array.isArray(source.candidates) ? source.candidates : [],
  };
}

export class FileAiLearningRepository extends AtomicJsonStore {
  constructor(filePath, redis = null, options = {}) {
    super(filePath, redis, options, {
      redisKey: "marketify:store:ai-learning:v1",
      r2FileName: "ai-learning-v1.json",
      empty: EMPTY_LEARNING_STORE,
      normalize: normalizeStore,
    });
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
