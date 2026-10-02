import fs from 'node:fs/promises';
import path from 'node:path';
import { isR2Configured, listTenantObjects, readTenantObject } from '../../http/r2-storage.js';
export const GUEST_RETENTION_MS = 7 * 86400000;
export function guestVisible(record, ownerId, now = Date.now()) {
  if (!ownerId?.startsWith('guest_')) return true;
  const created = Date.parse(record.createdAt);
  return Number.isFinite(created) && now - created < GUEST_RETENTION_MS;
}
export function guestQuota(records, ownerId, limit, additions) {
  if (ownerId?.startsWith('guest_') && records.filter(record => !record.deleted && guestVisible(record, ownerId)).length + additions > limit) throw Object.assign(new Error('Guest resource limit'), { status: 429, statusCode: 429, code: 'GUEST_STORAGE_LIMIT' });
}
export class GuestRetention {
  constructor(repositories) { this.repositories = repositories; this.running = false; }
  async prune() {
    if (this.running) return; this.running = true;
    try {
      for (const { repo, prefix, directory, chats = false } of this.repositories) {
        const shards = [];
        if (isR2Configured()) {
          for (const key of await listTenantObjects(`${prefix}/`)) shards.push((await readTenantObject(key)).record);
        } else {
          let names; try { names = await fs.readdir(directory); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
          for (const name of names.filter(name => /^[a-f0-9]{64}\.json$/.test(name))) shards.push(JSON.parse(await fs.readFile(path.join(directory, name), 'utf8')));
        }
        for (const shard of shards.filter(Array.isArray)) {
          const owners = new Set(shard.filter(record => record.ownerId?.startsWith('guest_') && !guestVisible(record, record.ownerId)).map(record => record.ownerId));
          for (const owner of owners) await repo.mutateTenant(owner, async records => {
            const expired = records.filter(record => !guestVisible(record, owner));
            if (chats) for (const chat of expired.filter(chat => !chat.deleted)) await repo.cleanupQueue?.enqueue(chat);
            const kept = records.filter(record => guestVisible(record, owner));
            return { records: kept, updated: kept, result: expired.length };
          });
        }
      }
    } finally { this.running = false; }
  }
}
