import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export class FileStrategyRepository {
  constructor(filePath) {
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
  }

  async ensure() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "[]\n", "utf8");
    }
  }

  async readAll() {
    await this.ensure();
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const data = JSON.parse(raw || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error("Strategy storage contains invalid JSON.");
        return [];
      }
      throw error;
    }
  }

  async writeAll(records) {
    const operation = async () => {
      await this.ensure();
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
      await fs.rename(temporaryPath, this.filePath);
    };
    this.writeQueue = this.writeQueue.then(operation, operation);
    return this.writeQueue;
  }

  async list(ownerId) {
    const records = await this.readAll();
    return records
      .filter((record) => record.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ versions, ownerId: _ownerId, clientSaveId: _clientSaveId, ...record }) => ({
        ...record,
        versionCount: versions.length,
      }));
  }

  async getById(id, ownerId) {
    const records = await this.readAll();
    return records.find((record) => record.id === id && record.ownerId === ownerId) || null;
  }

  async create(payload, ownerId) {
    const records = await this.readAll();
    const duplicate = records.find(
      (record) => record.ownerId === ownerId && record.clientSaveId === payload.clientSaveId,
    );
    if (duplicate) return duplicate;

    const now = new Date().toISOString();
    const versions = payload.versions.map((version) => ({
      ...version,
      id: randomUUID(),
    }));
    const record = {
      id: randomUUID(),
      ownerId,
      clientSaveId: payload.clientSaveId,
      title: payload.strategy.title,
      brief: payload.brief,
      clarification: { answers: payload.answers },
      strategy: payload.strategy,
      status: "saved",
      currentVersionId: versions.at(-1).id,
      versions,
      createdAt: now,
      updatedAt: now,
    };
    records.push(record);
    await this.writeAll(records);
    return record;
  }

  async appendVersion(id, ownerId, strategy, changeRequest) {
    const records = await this.readAll();
    const index = records.findIndex((record) => record.id === id && record.ownerId === ownerId);
    if (index === -1) return null;

    const record = records[index];
    const version = {
      id: randomUUID(),
      versionNumber: record.versions.length + 1,
      data: strategy,
      changeRequest,
      createdAt: new Date().toISOString(),
    };
    records[index] = {
      ...record,
      title: strategy.title,
      strategy,
      status: "saved",
      currentVersionId: version.id,
      versions: [...record.versions, version],
      updatedAt: version.createdAt,
    };
    await this.writeAll(records);
    return records[index];
  }
}
