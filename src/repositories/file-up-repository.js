import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isR2Configured, readUpObject, writeUpObject } from '../http/r2-storage.js';
import { migrateUpState } from './up-migrations.js';
import { fail } from '../services/up/domain.js';

export class FileUpRepository {
  constructor(directory, options = {}) {
    this.directory = directory;
    this.cloud = options.cloud ?? isR2Configured();
    this.readCloud = options.readCloud || readUpObject;
    this.writeCloud = options.writeCloud || writeUpObject;
  }
  key(ownerId) {
    if (!/^(?:usr_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId)) fail('INVALID_OWNER');
    return createHash('sha256').update(ownerId).digest('hex');
  }
  async read(ownerId) {
    const key = this.key(ownerId);
    if (this.cloud) return migrateUpState((await this.readCloud(key)).record, ownerId);
    try { return migrateUpState(JSON.parse(await fs.readFile(path.join(this.directory, `${key}.json`), 'utf8')), ownerId); }
    catch (error) { if (error.code === 'ENOENT') return migrateUpState(null, ownerId); throw error; }
  }
  // Callbacks are synchronous/pure: optimistic retries never repeat a model request.
  async mutate(ownerId, change) {
    const key = this.key(ownerId);
    if (this.cloud) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const { record, etag } = await this.readCloud(key);
        const state = migrateUpState(record, ownerId);
        const result = change(state);
        if (result?.then) throw new Error('UP mutation must be synchronous');
        state.revision++;
        this.checkSize(state);
        if (await this.writeCloud(key, state, etag)) return structuredClone(result);
      }
      fail('STORAGE_BUSY', 503);
    }
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const lock = path.join(this.directory, `${key}.lock`);
    let acquired = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try { await fs.mkdir(lock); acquired = true; await fs.writeFile(path.join(lock, 'pid'), String(process.pid)); break; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        // Recover a crashed process only after proving it no longer exists.
        try {
          const pid = Number(await fs.readFile(path.join(lock, 'pid'), 'utf8'));
          if (Number.isInteger(pid) && pid > 0) {
            try { process.kill(pid, 0); } catch (dead) { if (dead.code === 'ESRCH') await fs.rm(lock, { recursive: true, force: true }); }
          }
        } catch { /* Another process may be initializing its lock. */ }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    if (!acquired) fail('STORAGE_BUSY', 503);
    const temporary = path.join(this.directory, `${key}.${randomUUID()}.tmp`);
    try {
      const state = await this.read(ownerId), result = change(state);
      if (result?.then) throw new Error('UP mutation must be synchronous');
      state.revision++; this.checkSize(state);
      const handle = await fs.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(state)); await handle.sync(); } finally { await handle.close(); }
      await fs.rename(temporary, path.join(this.directory, `${key}.json`));
      return structuredClone(result);
    } finally { await fs.rm(temporary, { force: true }); await fs.rm(lock, { recursive: true, force: true }); }
  }
  checkSize(state) { if (Buffer.byteLength(JSON.stringify(state)) > 20 * 1024 * 1024) fail('STORAGE_LIMIT', 409); }
  async deleteAllByOwner(ownerId) {
    // Persist a tombstone atomically so an in-flight evaluator cannot resurrect data.
    await this.mutate(ownerId, state => {
      const revision = state.revision;
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, migrateUpState(null, ownerId), { revision, deleted: true });
    });
    return 1;
  }
}
