import { AsyncLocalStorage } from 'node:async_hooks';

export const executionContext = new AsyncLocalStorage();
export function privacySnapshot(user) {
  return { enabled: user?.settings?.modelImprovement === true, epoch: user?.privacyEpoch || 0, ownerId: user?.id };
}
export class PrivacyPolicy {
  constructor(users) { this.users = users; }
  async allows(ownerId, snapshot) {
    if (!ownerId || typeof ownerId !== 'string' || ownerId.startsWith('guest_')) return false;
    const store = executionContext.getStore();
    const effectiveSnapshot = snapshot !== undefined
      ? snapshot
      : (store?.ownerId === ownerId ? store?.privacySnapshot : null);

    if (effectiveSnapshot && !effectiveSnapshot.enabled) return false;
    try {
      const user = await this.users.findById(ownerId);
      if (!user || user.status !== 'active' || user.scheduledDeletionAt || user.settings?.modelImprovement !== true) {
        return false;
      }
      if (effectiveSnapshot && (user.privacyEpoch || 0) !== effectiveSnapshot.epoch) {
        return false;
      }
      return true;
    } catch { return false; }
  }
  middleware() {
    return (req, res, next) => {
      const context = { ownerId: req.ownerId, privacySnapshot: privacySnapshot(req.user), providerStarted: false, guest: !req.user, signal: null };
      req.securityContext = context;
      executionContext.run(context, next);
    };
  }
}
