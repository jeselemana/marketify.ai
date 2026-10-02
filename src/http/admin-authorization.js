export function createRequireAdmin(adminIdentities = new Set()) {
  const allowed = adminIdentities instanceof Set ? adminIdentities : new Set(adminIdentities);
  return function requireAdmin(req, res, next) {
    res.setHeader?.('Cache-Control', 'no-store');
    const isAllowed = Boolean(req.user?.id && (allowed.has(req.user.id) || (req.user.username && allowed.has(req.user.username))));
    if (!req.user?.emailVerifiedAt || !isAllowed) return res.status(404).json({ error: 'Yol tapılmadı.', code: 'NOT_FOUND' });
    const sensitive = req.method !== 'GET' || /\/export(?:\?|$)/.test(req.originalUrl || '');
    const verifiedAt = req.auth?.session?.mfaVerifiedAt;
    if (!Number.isFinite(verifiedAt) || verifiedAt > Date.now() || Date.now() - verifiedAt > (sensitive ? 5 : 15) * 60000) {
      if (req.method === 'GET' && req.accepts?.('html') && !req.originalUrl?.includes('/api/')) return res.redirect('/admin-mfa');
      return res.status(403).json({ error: 'Admin MFA təsdiqi tələb olunur.', code: 'MFA_REQUIRED' });
    }
    return next();
  };
}
