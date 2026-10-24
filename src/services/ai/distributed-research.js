import { assertPlatformEnabled } from '../security/provider-policy.js';
import { ResearchService } from './research-service.js';
import { PrivacyPolicy, executionContext } from '../security/privacy-policy.js';
import { acquireOwnerExecutionLease } from '../security/owner-execution-lease.js';

const terminal = status => ['completed', 'failed', 'cancelled', 'interrupted', 'deleted'].includes(status);
const revoked = () => Object.assign(new Error('Execution authorization revoked'), { code: 'EXECUTION_REVOKED', status: 403 });

export class DistributedResearchService extends ResearchService {
  constructor({ jobStore, redis, userRepository, recoveryIntervalMs = 60000, ...options }) {
    super(options);
    Object.assign(this, { jobStore, redis, userRepository });
    this.privacyPolicy = userRepository ? new PrivacyPolicy(userRepository) : null;
    this.pendingOwners = new Set();
    this.subClients = new Set();
    this.stopping = false;
    if (this.redis?.isReady) this.initDistributedSignals().catch(() => {});
    this.recoveryTimer = setInterval(() => this.resumeOrphanedJobs().catch(() => {}), recoveryIntervalMs);
    this.recoveryTimer.unref();
  }

  async initDistributedSignals() {
    if (!this.redis?.duplicate) return;
    const sub = this.redis.duplicate();
    this.subClients.add(sub);
    try {
      await sub.connect();
      await sub.subscribe('helmer:research:cancel', message => {
        try {
          const { jobId, ownerId } = JSON.parse(message);
          const job = this.activeJobs.get(jobId);
          if (job && ownerId === job.ownerId) job.abortController.abort(revoked());
        } catch {}
      });
    } catch { this.subClients.delete(sub); await sub.quit().catch(() => {}); }
  }

  async assertJobOwned(job) {
    await job.executionLease?.lease.assertOwned?.();
    if (this.redis?.isReady && job.researchLeaseToken && await this.redis.get(`helmer:research:lease:${job.id}`) !== job.researchLeaseToken) throw Object.assign(new Error('Research lease lost'), { code: 'EXECUTION_LOCK_LOST' });
    if (this.jobStore) {
      const saved = await this.jobStore.read(`research:${job.id}`);
      if (!saved || saved.executionFence !== job.executionFence) throw Object.assign(new Error('Research ownership lost'), { code: 'EXECUTION_LOCK_LOST' });
    }
  }

  async claimJob(job) {
    await job.executionLease?.lease.assertOwned?.();
    await this.jobStore?.mutate(`research:${job.id}`, async current => {
      await job.executionLease?.lease.assertOwned?.();
      if (!current || current.ownerId !== job.ownerId || terminal(current.status)) throw revoked();
      job.executionFence = (current.executionFence || 0) + 1;
      return { value: { ...current, executionFence: job.executionFence }, result: job.executionFence };
    });
    if (job.executionFence !== undefined) await this.chatRepository.claimResearchMessage?.(job.chatId, job.ownerId, job.id, job.executionFence);
  }

  async assertJobAuthorized(job) {
    try {
      job.abortController.signal.throwIfAborted();
      await assertPlatformEnabled();
      await this.assertJobOwned(job);
      if (this.privacyPolicy) await this.privacyPolicy.assertExecution({ ownerId: job.ownerId, privacySnapshot: job.privacySnapshot, signal: job.abortController.signal });
      const chat = await this.chatRepository.getById(job.chatId, job.ownerId);
      if (!chat || chat.deleted) throw revoked();
      if (job.strategyId && !await this.strategyRepository?.getById(job.strategyId, job.ownerId)) throw revoked();
      if (job.taskId && !(await this.plannerRepository?.list(job.ownerId) || []).some(task => task.id === job.taskId)) throw revoked();
      if (this.jobStore) {
        const durable = await this.jobStore.read(`research:${job.id}`);
        if (!durable || durable.ownerId !== job.ownerId || ['cancelled', 'deleted', 'interrupted'].includes(durable.status)) throw revoked();
      }
    } catch (error) { job.abortController.abort(error); throw error; }
  }

  snapshot(job) {
    return Object.fromEntries(['executionFence', 'id', 'messageId', 'ownerId', 'chatId', 'prompt', 'language', 'strategyId', 'taskId', 'strategyContext', 'taskContext', 'privacySnapshot', 'status', 'steps', 'sources', 'artifacts', 'content', 'error', 'groundingMetadata', 'createdAt', 'deadlineAt', 'checkpoint', 'usageByModel', 'model', 'provider'].map(key => [key, structuredClone(job[key])]));
  }

  async persistCheckpoint(jobId, patch, { create = false, control = false, worker = this.activeJobs.get(jobId) } = {}) {
    if (!this.jobStore) return;
    const job = worker;
    if (!create && !control) await this.assertJobOwned(job || { id: jobId, executionFence: patch.executionFence });
    const fence = patch.executionFence ?? job?.executionFence;
    await this.jobStore.mutate(`research:${jobId}`, async current => {
      if (!control) await job?.executionLease?.lease.assertOwned?.();
      // CAS fencing rejects late writes even if a successor is also running.
      if ((create && current?.executionFence !== undefined) || (!create && !control && current?.executionFence !== fence)) throw Object.assign(new Error('Research ownership lost'), { code: 'EXECUTION_LOCK_LOST' });
      if (!current && !create) throw revoked();
      if (current && patch.ownerId && current.ownerId !== patch.ownerId) throw revoked();
      if (current && patch.status !== 'deleted' && (['cancelled', 'deleted', 'interrupted'].includes(current.status) || (terminal(current.status) && patch.status && current.status !== patch.status))) {
        if (current?.status === patch.status) return { value: current, result: current };
        throw revoked();
      }
      const next = { ...(current || {}), ...patch, version: 1, updatedAt: new Date().toISOString() };
      return { value: next, result: next };
    });
  }

  async prepareJob(job) {
    await this.persistCheckpoint(job.id, this.snapshot(job), { create: true });
  }

  async prepareIntent(job) {
    await this.persistCheckpoint(job.id, this.snapshot(job), { create: true });
  }

  async createResearchJob(args) {
    if (this.stopping || this.pendingOwners.has(args.ownerId) || this.hasActiveJobForOwner(args.ownerId)) throw Object.assign(new Error('Execution busy'), { code: 'EXECUTION_BUSY', status: 429 });
    this.pendingOwners.add(args.ownerId);
    const controller = new AbortController();
    const request = executionContext.getStore();
    let lease, admission;
    try {
      lease = request?.transferToBackground ? request.transferToBackground() : await acquireOwnerExecutionLease(this.redis, args.ownerId, controller);
      // prepareJob runs before execution starts, so admission is held through persistence.
      // Per-call lease is passed through args rather than shared mutable callback state.
      admission = { lease, controller };
      const result = await super.createResearchJob({ ...args, executionLease: admission });
      return result;
    } catch (error) {
      for (const [id, job] of this.activeJobs) if (job.ownerId === args.ownerId && !job.executionPromise) {
        job.detachLease?.(); job.abortController.abort(error); this.activeJobs.delete(id);
      }
      if (admission?.intent) await this.persistCheckpoint(admission.intent.id, { ownerId: args.ownerId, status: 'failed', error: 'Research initialization failed.', prompt: null, strategyContext: null, taskContext: null, checkpoint: null }, { worker: { ...admission.intent, executionLease: admission } }).catch(() => {});
      await lease?.release();
      throw error;
    } finally { this.pendingOwners.delete(args.ownerId); }
  }

  async executeJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    let checking = false;
    const authority = setInterval(async () => {
      if (checking) return;
      checking = true;
      try { await this.assertJobAuthorized(job); } catch {} finally { checking = false; }
    }, 1000);
    authority.unref();
    try {
      if (job.executionFence === undefined) await this.claimJob(job);
      await this.assertJobAuthorized(job);
      await super.executeJob(jobId);
    } catch (error) {
      job.abortController.abort(error);
      const isRestart = job.abortController.signal.reason?.code === 'RESEARCH_RESTART' || error?.code === 'RESEARCH_RESTART';
      job.status = isRestart ? 'pending' : 'cancelled';
      job.error = isRestart ? null : (job.language === 'en' ? 'Research was canceled.' : 'Araşdırma dayandırıldı.');
      await this.persistJobMessage(job).catch(() => {});
      await this.broadcast(jobId, {
        type: isRestart ? 'step' : 'failed',
        status: job.status,
        error: job.error,
        steps: job.steps,
      });
    } finally {
      clearInterval(authority);
      job.detachLease?.();
      await job.executionLease?.lease.release();
    }
  }

  async persistJobMessage(job) {
    await this.assertJobOwned(job);
    if (!job.abortController?.signal.aborted && !['failed', 'cancelled', 'interrupted'].includes(job.status)) await this.assertJobAuthorized(job);
    // Durable CAS is the authority; the chat is a separately fenced projection.
    await this.persistCheckpoint(job.id, this.snapshot(job), { worker: job });
    await super.persistJobMessage(job);
  }

  async rollbackJobArtifacts(job) {
    await this.assertJobOwned(job);
    return super.rollbackJobArtifacts(job);
  }

  broadcast(jobId, eventData) {
    const job = this.activeJobs.get(jobId);
    if (!job) return Promise.resolve();
    return this.assertJobOwned(job).then(() => {
      super.broadcast(jobId, eventData);
      if (eventData && this.redis?.isReady) return this.redis.publish(`helmer:research:${jobId}`, JSON.stringify(eventData));
    }).catch(() => {});
  }

  async getJob(jobId, ownerId) {
    if (!ownerId || !/^[A-Za-z0-9_-]{1,80}$/.test(String(jobId || ''))) return null;
    const local = await super.getJob(jobId, ownerId);
    if (local) return local;
    const remote = await this.jobStore?.read(`research:${jobId}`);
    if (!remote || remote.ownerId !== ownerId || remote.status === 'deleted') return null;
    const chat = remote.chatId ? await this.chatRepository.getById(remote.chatId, ownerId) : null;
    if (!chat || chat.deleted) {
      await this.persistCheckpoint(jobId, { ownerId, status: 'deleted', prompt: null, content: null, checkpoint: null, strategyContext: null, taskContext: null, sources: [], artifacts: [] }, { control: true }).catch(() => {});
      return null;
    }
    return { id: remote.id || jobId, chatId: remote.chatId, status: remote.status, steps: remote.steps || [], sources: remote.sources || [], artifacts: remote.artifacts || [], groundingMetadata: remote.groundingMetadata || null, content: remote.content || '', error: remote.error || null, createdAt: remote.createdAt, updatedAt: remote.updatedAt };
  }

  subscribe(jobId, ownerId, listener) {
    const unsubscribeLocal = super.subscribe(jobId, ownerId, listener);
    let remoteSub, closed = false;
    if (this.redis?.isReady && !this.activeJobs.has(jobId)) {
      (async () => {
        try {
          if (!await this.getJob(jobId, ownerId) || closed) return;
          remoteSub = this.redis.duplicate();
          this.subClients.add(remoteSub);
          await remoteSub.connect();
          if (closed) { await remoteSub.quit(); this.subClients.delete(remoteSub); return; }
          await remoteSub.subscribe(`helmer:research:${jobId}`, async message => {
            try { if (!closed && await this.getJob(jobId, ownerId)) listener(JSON.parse(message)); } catch {}
          });
        } catch {}
      })();
    }
    return () => {
      closed = true;
      unsubscribeLocal?.();
      if (remoteSub) { this.subClients.delete(remoteSub); remoteSub.quit().catch(() => {}); }
    };
  }

  async cancelJob(jobId, ownerId) {
    const visible = ownerId ? await this.getJob(jobId, ownerId) : null;
    if (!visible || terminal(visible.status)) return false;
    const current = await this.jobStore?.read(`research:${jobId}`);
    if (current && !terminal(current.status)) await this.persistCheckpoint(jobId, { ownerId, status: 'cancelled' }, { control: true });
    await super.cancelJob(jobId, ownerId);
    if (this.redis?.isReady) await this.redis.publish('helmer:research:cancel', JSON.stringify({ jobId, ownerId })).catch(() => {});
    return true;
  }

  async resumeOrphanedJobs() {
    if (this.stopping || this.recovering || !this.jobStore) return;
    this.recovering = true;
    try {
      for (const entry of await this.jobStore.entries()) {
        if (this.stopping) break;
        const saved = entry.value;
        if (!entry.key?.startsWith('research:') || !saved || terminal(saved.status) || this.activeJobs.has(saved.id)) continue;
        if (this.redis?.isReady && await this.redis.get(`helmer:research:lease:${saved.id}`)) continue;
        if (this.pendingOwners.has(saved.ownerId) || this.hasActiveJobForOwner(saved.ownerId)) continue;
        this.pendingOwners.add(saved.ownerId);
        let lease;
        const job = { ...saved, steps: saved.steps?.length ? saved.steps : this.createInitialSteps(saved.language), modelImprovement: false, startedAt: Date.now(), subscribers: new Set(), abortController: new AbortController() };
        try {
          lease = await acquireOwnerExecutionLease(this.redis, job.ownerId, job.abortController);
          if (this.stopping) { await lease.release(); break; }
          job.executionLease = { lease };
          await this.claimJob(job);
          if (saved.version !== 1 || !saved.privacySnapshot || !saved.deadlineAt || saved.deadlineAt <= Date.now()) {
            job.status = 'interrupted';
            await this.persistJobMessage(job);
            await lease.release();
            continue;
          }
          await this.assertJobAuthorized(job);
          this.activeJobs.set(job.id, job);
          const context = { ownerId: job.ownerId, privacySnapshot: job.privacySnapshot, signal: job.abortController.signal, controller: job.abortController, guest: false, isBackgroundJob: true, assertAuthorized: () => this.assertJobAuthorized(job) };
          context.onProviderUsage = usage => this.recordProviderUsage(job, usage);
          const promise = executionContext.run(context, () => this.executeJob(job.id));
          job.executionPromise = promise;
          this.runningJobPromises.add(promise);
          promise.finally(() => this.runningJobPromises.delete(promise));
        } catch (error) {
          if (lease && error.code !== 'EXECUTION_BUSY') {
            job.status = 'interrupted';
            await this.persistCheckpoint(job.id, this.snapshot(job), { worker: job }).catch(() => {});
          }
          await lease?.release();
        } finally { this.pendingOwners.delete(saved.ownerId); }
      }
    } finally { this.recovering = false; }
  }

  async shutdown() {
    this.stopping = true;
    clearInterval(this.recoveryTimer);
    for (const job of this.activeJobs.values()) if (!terminal(job.status)) job.abortController.abort(Object.assign(new Error('Research worker shutting down'), { code: 'RESEARCH_RESTART' }));
    await this.waitForAllJobs();
    await Promise.allSettled([...this.subClients].map(sub => sub.quit()));
    this.subClients.clear();
  }
}
