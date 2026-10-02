import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isR2Configured, readTenantObject, writeTenantObject, listTenantObjects } from '../../http/r2-storage.js';
import { TenantLockManager } from '../../repositories/tenant-lock.js';
import { writeJsonAtomically } from '../../repositories/atomic-json-store.js';

export class DurableStore {
  constructor(directory, { cloud = isR2Configured(), read = readTenantObject, write = writeTenantObject, list = listTenantObjects } = {}) {
    this.directory = directory; this.cloud = cloud; this.readCloud = read; this.writeCloud = write; this.listCloud = list;
    this.locks = new TenantLockManager(directory);
  }
  name(key) { return createHash('sha256').update(key).digest('hex'); }
  async read(key) {
    if (this.cloud) return (await this.readCloud(`security-v4/${this.name(key)}.json`)).record?.value ?? null;
    try { return JSON.parse(await fs.readFile(path.join(this.directory, `${this.name(key)}.json`), 'utf8')).value; }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  mutate(key, operation) {
    return this.locks.runInLock(this.name(key), async () => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const objectKey = `security-v4/${this.name(key)}.json`;
        const existing = this.cloud ? await this.readCloud(objectKey) : { record: { value: await this.read(key) } };
        const { value, result } = await operation(structuredClone(existing.record?.value ?? null));
        const record = { key, value, updatedAt: Date.now() };
        if (this.cloud && !await this.writeCloud(objectKey, record, existing.etag)) continue;
        await writeJsonAtomically(path.join(this.directory, `${this.name(key)}.json`), record);
        return result;
      }
      throw Object.assign(new Error('Storage concurrency conflict'), { code: 'STORAGE_BUSY', status: 503 });
    });
  }
  async entries() {
    if (this.cloud) {
      const keys = await this.listCloud('security-v4/');
      const records = [];
      for (const key of keys) { const item = (await this.readCloud(key)).record; if (item) records.push(item); }
      return records;
    }
    let names; try { names = await fs.readdir(this.directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const records = [];
    for (const name of names.filter(name => /^[a-f0-9]{64}\.json$/.test(name))) records.push(JSON.parse(await fs.readFile(path.join(this.directory, name), 'utf8')));
    return records;
  }
}
