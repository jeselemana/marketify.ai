export function validateSecurityConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const missing = [];
  if (!env.SESSION_SECRET?.trim()) missing.push('SESSION_SECRET');
  if (!env.AUTH_SECRET?.trim()) missing.push('AUTH_SECRET');
  if (env.ADMIN_MFA_ENCRYPTION_KEY) {
    const key = Buffer.from(env.ADMIN_MFA_ENCRYPTION_KEY, 'base64');
    if (key.length !== 32) throw new Error('ADMIN_MFA_ENCRYPTION_KEY must be a 32-byte base64-encoded string');
  }
  if (missing.length > 0) {
    throw new Error(`Production environment requires configured secrets: ${missing.join(', ')}`);
  }
  if (!env.APP_URL || !/^https:\/\//.test(env.APP_URL)) {
    throw new Error('APP_URL must be an HTTPS URL in production');
  }
}
