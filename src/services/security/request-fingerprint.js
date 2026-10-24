import { createHash } from 'node:crypto';

export function requestFingerprint(value) {
  const canonical = input => Array.isArray(input) ? input.map(canonical) : input && typeof input === 'object'
    ? Object.fromEntries(Object.keys(input).sort().map(key => [key, canonical(input[key])])) : input;
  return createHash('sha256').update(JSON.stringify(canonical(value)) || '').digest('hex');
}
