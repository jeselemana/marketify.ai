import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export class FileChatRepository {
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
        console.error("Chat storage contains invalid JSON.");
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
      .map(({ messages, ...record }) => ({
        ...record,
        messageCount: messages.length,
        lastMessage: messages.at(-1)?.content?.slice(0, 100) || "",
      }));
  }

  async getById(id, ownerId) {
    const records = await this.readAll();
    return records.find((record) => record.id === id && record.ownerId === ownerId) || null;
  }

  async saveChat({ id, ownerId, title, messages, strategyId }) {
    const records = await this.readAll();
    const now = new Date().toISOString();
    const existingIndex = id ? records.findIndex((r) => r.id === id && r.ownerId === ownerId) : -1;

    if (existingIndex >= 0) {
      records[existingIndex] = {
        ...records[existingIndex],
        title: title || records[existingIndex].title,
        messages,
        strategyId: strategyId !== undefined ? strategyId : records[existingIndex].strategyId,
        updatedAt: now,
      };
      await this.writeAll(records);
      return records[existingIndex];
    }

    const chatId = id || randomUUID();
    const firstUserMsg = messages.find((m) => m.role === "user")?.content || "";
    const cleanTitle = title || (firstUserMsg.length > 50 ? `${firstUserMsg.slice(0, 48)}…` : firstUserMsg) || "Yeni söhbət";
    const newRecord = {
      id: chatId,
      ownerId,
      title: cleanTitle,
      messages,
      strategyId: strategyId || null,
      createdAt: now,
      updatedAt: now,
    };
    records.push(newRecord);
    await this.writeAll(records);
    return newRecord;
  }

  async delete(id, ownerId) {
    const records = await this.readAll();
    const filtered = records.filter((r) => !(r.id === id && r.ownerId === ownerId));
    if (filtered.length !== records.length) {
      await this.writeAll(filtered);
      return true;
    }
    return false;
  }

  async claimOwner(previousOwnerId, ownerId) {
    if (!previousOwnerId || previousOwnerId === ownerId) return 0;
    const records = await this.readAll();
    let count = 0;
    for (const record of records) {
      if (record.ownerId === previousOwnerId) {
        record.ownerId = ownerId;
        count += 1;
      }
    }
    if (count > 0) {
      await this.writeAll(records);
    }
    return count;
  }
}
