export class CleanupQueue {
  constructor(store, artifacts, cache) {
    this.store = store;
    this.artifacts = artifacts;
    this.cache = cache;
    this.timer = setInterval(() => this.process().catch(() => {}), 60000);
    this.timer.unref();
  }
  async enqueue(ownerId, id, type = 'chat', metadata = {}) {
    const key = `cleanup:${ownerId}:${id}`;
    await this.store.mutate(key, () => ({ value: { ownerId, id, type, metadata, queuedAt: Date.now(), attempts: 0 }, result: true }));
    void this.process();
  }
  async pending(ownerId, id) {
    const item = await this.store.read(`cleanup:${ownerId}:${id}`);
    return Boolean(item);
  }
  async process() {
    const entries = await this.store.entries().catch(() => []);
    for (const entry of entries) {
      if (!entry.key?.startsWith('cleanup:')) continue;
      const { ownerId, id, type, metadata } = entry.value || {};
      try {
        if (type === 'chat' && metadata?.messages) {
          await this.artifacts?.deleteChatArtifacts({ id, ownerId, messages: metadata.messages });
        }
        if (this.cache?.removeOwnerFiles) this.cache.removeOwnerFiles(ownerId);
        await this.store.mutate(entry.key, () => ({ value: null, result: true }));
      } catch (err) {
        await this.store.mutate(entry.key, (current) => ({ value: current ? { ...current, attempts: (current.attempts || 0) + 1, lastError: err.message } : null, result: false }));
      }
    }
  }
}
