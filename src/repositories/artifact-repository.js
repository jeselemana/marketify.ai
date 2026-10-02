import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { uuid } from "../services/artifacts/schemas.js";
import { z } from "zod";
import { putArtifactObject, getArtifactObject, readArtifactObject, deleteArtifactObject, isR2Configured } from "../http/r2-storage.js";
import { TenantLockManager } from "./tenant-lock.js";
const ownerIdentifier = z.string().regex(/^(?:usr_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const mimeTypes = { docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf" };

export function safeArtifactFilename(title, extension) {
  if (!["docx", "xlsx", "pptx", "pdf"].includes(extension)) throw new Error("Invalid artifact extension");
  const clean = String(title).normalize("NFKC").replace(/[\x00-\x1f\x7f<>:"/\\|?*\u202a-\u202e\u2066-\u2069]/g, "_").replace(/^\.+|[. ]+$/g, "").replace(/\s+/g, "_").slice(0, 100);
  const reserved = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(clean);
  return `${reserved ? "Helmer_" : ""}${clean || "Helmer_Artifact"}.${extension}`;
}
export function publicArtifact(record, version = record.versions.at(-1)) {
  return { id: record.id, pluginId: record.pluginId, outputLabel: record.outputLabel, version: version.version, filename: version.filename, mimeType: record.mimeType, size: version.size, createdAt: version.createdAt,
    downloadUrl: `/api/artifacts/${record.id}/versions/${version.version}/download`, previewUrl: `/api/artifacts/${record.id}/versions/${version.version}/preview` };
}

export class ArtifactRepository {
  constructor(directory, redis = null) { this.directory = directory; this.redis = redis; this.queue = Promise.resolve(); this.locks = new TenantLockManager(directory); }
  location(ownerId, id, name = "manifest.json") {
    ownerIdentifier.parse(ownerId); uuid.parse(id);
    const ownerHash = createHash("sha256").update(ownerId).digest("hex");
    return { local: path.join(this.directory, ownerHash, id, name), key: `artifacts/${ownerHash}/${id}/${name}` };
  }
  async read(id, ownerId) {
    const location = this.location(ownerId, id);
    if (isR2Configured()) return readArtifactObject(location.key);
    try { return { buffer: await fs.readFile(location.local), etag: null }; }
    catch (error) { if (error.code === "ENOENT") return { buffer: null, etag: null }; throw error; }
  }
  decode(buffer, id, ownerId) {
    if (!buffer) return null;
    const record = JSON.parse(buffer.toString());
    if (record.deleted) return null;
    if (!mimeTypes[record.extension] || mimeTypes[record.extension] !== record.mimeType || !Array.isArray(record.versions) || record.versions.length > 100) throw new Error("Invalid artifact manifest");
    return record.ownerId === ownerId && record.id === id ? record : null;
  }
  async get(id, ownerId) { return this.decode((await this.read(id, ownerId)).buffer, id, ownerId); }
  async coordinate(id, ownerId, operation) {
    const hash = createHash("sha256").update(`${ownerId}:${id}`).digest("hex");
    return this.locks.runInLock(hash, async () => {
      if ((process.env.NODE_ENV === "production" && isR2Configured() && !this.redis?.isReady) || (this.redis && !this.redis.isReady)) throw Object.assign(new Error("Artifact coordination unavailable"), { statusCode: 503 });
      const key = `helmer:artifact-lock:${ownerId}:${id}`, token = randomUUID();
      let timer, lost = false;
      const assertLease = async () => {
        if (lost || (this.redis && (!this.redis.isReady || await this.redis.get(key) !== token))) throw Object.assign(new Error("Artifact lease lost"), { statusCode: 503 });
      };
      if (this.redis?.isReady) {
        if (!await this.redis.set(key, token, { NX: true, PX: 60000 })) throw Object.assign(new Error("Artifact update conflict"), { statusCode: 409 });
        timer = setInterval(async () => {
          try { if (!await this.redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('pexpire',KEYS[1],60000) else return 0 end", { keys: [key], arguments: [token] })) lost = true; }
          catch { lost = true; }
        }, 10000); timer.unref();
      }
      try { return await operation(assertLease); }
      finally {
        clearInterval(timer);
        if (this.redis?.isReady) await this.redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", { keys: [key], arguments: [token] }).catch(() => {});
      }
    });
  }
  async publish(id, ownerId, record, etag, assertLease) {
    await assertLease();
    const location = this.location(ownerId, id), data = Buffer.from(JSON.stringify(record));
    if (data.length > 20 * 1024 * 1024) throw new Error("Artifact history size limit exceeded");
    if (isR2Configured()) {
      try { await putArtifactObject(location.key, data, "application/json", etag ? { IfMatch: etag } : { IfNoneMatch: "*" }); }
      catch (error) { if ([409,412].includes(error.$metadata?.httpStatusCode)) error.statusCode = 409; throw error; }
    }
    if (record.deleted) {
      await fs.rm(location.local, { recursive: true, force: true }).catch(() => {});
      return;
    }
    await fs.mkdir(path.dirname(location.local), { recursive: true, mode: 0o700 });
    const temporary = `${location.local}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temporary, data, { mode: 0o600 }); await assertLease(); await fs.rename(temporary, location.local); }
    finally { await fs.unlink(temporary).catch(() => {}); }
  }
  async save({ ownerId, chatId, plugin, spec, buffer, previous = null, execution }) {
    ownerIdentifier.parse(ownerId); uuid.parse(chatId);
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 25 * 1024 * 1024 || JSON.stringify(spec).length > 1500000) throw new Error("Artifact size limit exceeded");
    if (!mimeTypes[plugin.extension] || mimeTypes[plugin.extension] !== plugin.mimeType) throw new Error("Invalid artifact MIME or extension");
    const id = previous?.id || randomUUID();
    return this.coordinate(id, ownerId, async assertLease => {
      const stored = await this.read(id, ownerId);
      const current = this.decode(stored.buffer, id, ownerId);
      if (stored.buffer && !current) throw Object.assign(new Error("Artifact was deleted"), { statusCode: 404 });
      if (previous && (!current || current.chatId !== chatId || current.pluginId !== plugin.id || current.versions.at(-1)?.version !== previous.versions.at(-1)?.version)) throw Object.assign(new Error("Artifact version changed"), { statusCode: 409 });
      if (!previous && current) throw Object.assign(new Error("Artifact already exists"), { statusCode: 409 });
      if (current?.versions.length >= 100) throw new Error("Artifact version limit reached");
      // Immutable execution-specific binaries prevent stale writers overwriting later output.
      const version = (current?.nextVersion || current?.versions.at(-1)?.version || 0) + 1;
      const binaryName = execution ? `v${version}-${execution}.${plugin.extension}` : `v${version}.${plugin.extension}`;
      const snapshot = { version, binaryName, filename: safeArtifactFilename(spec.title, plugin.extension), size: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex"), createdAt: new Date().toISOString(), spec, execution };
      const record = current || { id, ownerId, chatId, pluginId: plugin.id, outputLabel: plugin.outputLabel || plugin.name, extension: plugin.extension, mimeType: plugin.mimeType, versions: [] };
      record.nextVersion = version; record.versions.push(snapshot);
      const binary = this.location(ownerId, id, binaryName);
      await assertLease();
      if (isR2Configured()) await putArtifactObject(binary.key, buffer, plugin.mimeType, { IfNoneMatch: "*" });
      else { await fs.mkdir(path.dirname(binary.local), { recursive: true, mode: 0o700 }); await fs.writeFile(binary.local, buffer, { flag: "wx", mode: 0o600 }); }
      // A failed/uncertain manifest write never rolls back another writer's manifest.
      try {
        await this.publish(id, ownerId, record, stored.etag, assertLease);
      } catch (err) {
        if (isR2Configured()) {
          await deleteArtifactObject(binary.key).catch(() => {});
          if (stored.buffer) await putArtifactObject(this.location(ownerId, id).key, stored.buffer, "application/json").catch(() => {});
          else await deleteArtifactObject(this.location(ownerId, id).key).catch(() => {});
        } else {
          await fs.unlink(binary.local).catch(() => {});
        }
        throw err;
      }
      return { record, artifact: publicArtifact(record, snapshot) };
    });
  }
  async download(record, version, ownerId) {
    if (record.ownerId !== ownerId) throw new Error("Artifact not found");
    const snapshot = record.versions.find(item => item.version === version);
    if (!snapshot) return null;
    const location = this.location(ownerId, record.id, snapshot.binaryName || `v${version}.${record.extension}`);
    const buffer = isR2Configured() ? await getArtifactObject(location.key) : await fs.readFile(location.local);
    if (!buffer || buffer.length !== snapshot.size || createHash("sha256").update(buffer).digest("hex") !== snapshot.sha256) throw new Error("Artifact integrity check failed");
    return { buffer, snapshot };
  }
  async rollback(artifact, ownerId) {
    return this.coordinate(artifact.id, ownerId, async assertLease => {
      const stored = await this.read(artifact.id, ownerId), record = this.decode(stored.buffer, artifact.id, ownerId);
      if (!record || record.versions.at(-1)?.version !== artifact.version) return;
      const removed = record.versions.pop();
      const binary = this.location(ownerId, record.id, removed.binaryName || `v${removed.version}.${record.extension}`);
      if (!record.versions.length) {
        record.deleted = true;
        const manifest = this.location(ownerId, record.id);
        await deleteArtifactObject(manifest.key);
        await fs.unlink(manifest.local).catch(error => { if (error.code !== "ENOENT") throw error; });
        await fs.rm(path.dirname(manifest.local), { recursive: true, force: true }).catch(() => {});
      } else {
        await this.publish(record.id, ownerId, record, stored.etag, assertLease);
      }
      await deleteArtifactObject(binary.key); await fs.unlink(binary.local).catch(error => { if (error.code !== "ENOENT") throw error; });
    });
  }
  async deleteChatArtifacts(chat) {
    const ids = new Set(chat.messages.flatMap(message => (message.artifacts || []).map(artifact => artifact.id)));
    for (const id of ids) await this.coordinate(id, chat.ownerId, async assertLease => {
      const stored = await this.read(id, chat.ownerId);
      if (!stored.buffer) return;
      const record = JSON.parse(stored.buffer.toString());
      if (record.ownerId !== chat.ownerId || record.chatId !== chat.id) return;
      // Keep the references in the tombstone until binary cleanup succeeds, allowing retries.
      record.deleted = true;
      await this.publish(id, chat.ownerId, record, stored.etag, assertLease);
      for (const version of record.versions) {
        await assertLease();
        const binary = this.location(chat.ownerId, id, version.binaryName || `v${version.version}.${record.extension}`);
        await deleteArtifactObject(binary.key);
        await fs.unlink(binary.local).catch(error => { if (error.code !== "ENOENT") throw error; });
      }
      const manifest = this.location(chat.ownerId, id);
      await deleteArtifactObject(manifest.key);
      await fs.rm(manifest.local, { recursive: true, force: true }).catch(() => {});
    });
  }
}
