import { ResearchService } from './research-service.js';

export class DistributedResearchService extends ResearchService {
  constructor({ jobStore, redis, userRepository, ...options }) {
    super(options);
    this.jobStore = jobStore;
    this.redis = redis;
    this.userRepository = userRepository;
    this.subClients = new Map();
    if (this.redis?.isReady) {
      this.initDistributedSignals().catch(() => {});
    }
  }

  async initDistributedSignals() {
    try {
      const sub = this.redis.duplicate();
      await sub.connect();
      await sub.subscribe('helmer:research:cancel', (message) => {
        try {
          const { jobId, ownerId } = JSON.parse(message);
          const job = this.activeJobs.get(jobId);
          if (job && (!ownerId || job.ownerId === ownerId)) {
            job.abortController?.abort(Object.assign(new Error('Job cancelled remotely'), { code: 'CANCELLED' }));
            job.status = 'cancelled';
          }
        } catch {}
      });
    } catch {}
  }

  async persistCheckpoint(jobId, patch) {
    if (!this.jobStore) return;
    try {
      await this.jobStore.mutate(`research:${jobId}`, (current) => {
        const next = { ...(current || {}), ...patch, updatedAt: new Date().toISOString() };
        return { value: next, result: next };
      });
    } catch (err) {
      console.warn(`[Distributed Research] Checkpoint failed for ${jobId}:`, err?.message || err);
    }
  }

  async createResearchJob(args) {
    const result = await super.createResearchJob(args);
    const job = this.activeJobs.get(result.jobId);
    if (job) {
      await this.persistCheckpoint(result.jobId, {
        id: job.id,
        ownerId: job.ownerId,
        chatId: job.chatId,
        prompt: job.prompt,
        status: job.status,
        steps: job.steps,
        sources: job.sources,
        createdAt: job.createdAt,
      });

      const originalEmit = job.emit;
      job.emit = (event) => {
        originalEmit?.call(job, event);
        if (event.type === 'step' || event.type === 'sources') {
          void this.persistCheckpoint(job.id, { steps: job.steps, sources: job.sources });
        } else if (event.type === 'done') {
          void this.persistCheckpoint(job.id, { status: 'completed', content: job.content, artifacts: job.artifacts });
        } else if (event.type === 'failed') {
          void this.persistCheckpoint(job.id, { status: 'failed', error: job.error });
        }
        if (this.redis?.isReady) {
          this.redis.publish(`helmer:research:${job.id}`, JSON.stringify(event)).catch(() => {});
        }
      };
    }
    return result;
  }

  async getJob(jobId, ownerId) {
    const local = await super.getJob(jobId, ownerId);
    if (local) return local;
    if (!this.jobStore) return null;
    const remote = await this.jobStore.read(`research:${jobId}`);
    if (remote && (!ownerId || remote.ownerId === ownerId)) {
      return remote;
    }
    return null;
  }

  subscribe(jobId, ownerId, listener) {
    const unsubscribeLocal = super.subscribe(jobId, ownerId, listener);
    let remoteSub = null;
    if (this.redis?.isReady && !this.activeJobs.has(jobId)) {
      (async () => {
        try {
          remoteSub = this.redis.duplicate();
          await remoteSub.connect();
          await remoteSub.subscribe(`helmer:research:${jobId}`, (msg) => {
            try { listener(JSON.parse(msg)); } catch {}
          });
        } catch {}
      })();
    }
    return () => {
      unsubscribeLocal?.();
      if (remoteSub) {
        remoteSub.unsubscribe(`helmer:research:${jobId}`).catch(() => {});
        remoteSub.quit().catch(() => {});
      }
    };
  }

  async cancelJob(jobId, ownerId) {
    const cancelledLocally = await super.cancelJob(jobId, ownerId);
    await this.persistCheckpoint(jobId, { status: 'cancelled' });
    if (this.redis?.isReady) {
      await this.redis.publish('helmer:research:cancel', JSON.stringify({ jobId, ownerId })).catch(() => {});
    }
    return cancelledLocally || true;
  }

  async resumeOrphanedJobs() {
    await super.resumeOrphanedJobs().catch(() => {});
    if (!this.jobStore) return;
    try {
      const entries = await this.jobStore.entries();
      for (const entry of entries) {
        if (!entry.key?.startsWith('research:')) continue;
        const job = entry.value;
        if (job && (job.status === 'running' || job.status === 'pending') && !this.activeJobs.has(job.id)) {
          console.log(`[Distributed Research] Marking interrupted job ${job.id}`);
          await this.persistCheckpoint(job.id, { status: 'interrupted' });
        }
      }
    } catch (err) {
      console.warn('[Distributed Research] Error checking durable store jobs:', err?.message || err);
    }
  }
}
