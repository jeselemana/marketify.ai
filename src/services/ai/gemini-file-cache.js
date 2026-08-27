import crypto from "node:crypto";

/**
 * Server-side File & Context Cache for Gemini 3.7 Flash.
 *
 * Solves two key problems for multi-turn Ask conversations:
 * 1. Network Bandwidth & Latency: Client does not repeatedly transmit 10-20MB base64 data on every follow-up turn.
 * 2. Token & Cost Optimization: For large documents (>=32,768 tokens), attempts Gemini Context Caching (75% token discount).
 *    For smaller or permission-restricted environments, seamlessly falls back to cached server-side multi-turn payloads.
 */
export class GeminiFileCache {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 60 * 60 * 1000; // 1 hour default TTL
    this.cache = new Map();
    this.hashToId = new Map();
    this.minTokenThresholdForGeminiCache = 32768; // Gemini API requirement for cachedContent

    // Periodic cleanup every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Compute sha256 hash of file content (data or textContent).
   */
  _computeHash(file) {
    const hasher = crypto.createHash("sha256");
    if (file.textContent) {
      hasher.update("text:" + file.textContent);
    } else if (file.data) {
      hasher.update("base64:" + file.data);
    } else {
      hasher.update("meta:" + (file.name || "") + ":" + (file.size || 0) + ":" + (file.type || file.mimeType || ""));
    }
    return hasher.digest("hex");
  }

  /**
   * Store a file in server cache and return its unique fileId.
   */
  storeFile(file) {
    if (!file || typeof file !== "object") return null;

    const hash = this._computeHash(file);
    if (this.hashToId.has(hash)) {
      const existingId = this.hashToId.get(hash);
      const existing = this.cache.get(existingId);
      if (existing && existing.expiresAt > Date.now()) {
        // Refresh TTL on reuse
        existing.expiresAt = Date.now() + this.ttlMs;
        return existingId;
      }
    }

    const fileId = file.fileId || ("gfc_" + crypto.randomUUID());
    const name = String(file.name || "fayl").trim();
    const mimeType = String(file.mimeType || file.type || "application/octet-stream").trim();
    const data = file.data ? String(file.data).replace(/^data:[^;]+;base64,/, "").trim() : "";
    const textContent = typeof file.textContent === "string" ? file.textContent : "";
    const size = Number(file.size) || 0;

    const entry = {
      fileId,
      hash,
      name,
      mimeType,
      type: mimeType,
      data,
      textContent,
      size,
      cachedContentName: null,
      cachedContentExpiresAt: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
    };

    this.cache.set(fileId, entry);
    this.hashToId.set(hash, fileId);
    return fileId;
  }

  /**
   * Retrieve cached file by fileId.
   */
  getFile(fileId) {
    if (!fileId) return null;
    const entry = this.cache.get(fileId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.deleteFile(fileId);
      return null;
    }
    // Refresh TTL on read
    entry.expiresAt = Date.now() + this.ttlMs;
    return entry;
  }

  /**
   * Hydrate / normalize message file object.
   * If message has only fileId or lightweight metadata, resolves full payload from server cache.
   */
  resolveFile(file) {
    if (!file) return null;
    if (file.data || file.textContent) {
      // Message has raw data; ensure it is stored and indexed in cache
      const fileId = this.storeFile(file);
      const entry = this.cache.get(fileId);
      return entry || file;
    }
    if (file.fileId) {
      const cached = this.getFile(file.fileId);
      if (cached) return cached;
    }
    return file;
  }

  /**
   * Estimate token count for text or binary file to decide on Gemini Context Caching.
   */
  estimateTokens(file) {
    if (!file) return 0;
    if (file.textContent) {
      // Rough estimate: ~4 characters per token
      return Math.ceil(file.textContent.length / 4);
    }
    if (file.data) {
      // For images, typical token cost is 258 to 1500 tokens.
      // For large PDFs, base64 payload of 1MB is ~30,000-40,000 tokens.
      const bytes = (file.data.length * 3) / 4;
      return Math.ceil(bytes / 30);
    }
    return 0;
  }

  /**
   * Attempt to create or reuse a Gemini Context Cache resource for large documents.
   * Safe with automatic graceful fallback if CacheService is not enabled on the API key or token count is < 32k.
   */
  async getOrCreateGeminiCachedContent({ geminiClient, model = "gemini-3.7-flash", file, systemInstruction = "" }) {
    if (!geminiClient || !file) return null;

    const fileEntry = this.resolveFile(file);
    if (!fileEntry) return null;

    // Check if we already have an active Gemini cache for this file
    if (fileEntry.cachedContentName && fileEntry.cachedContentExpiresAt > Date.now() + 60000) {
      return fileEntry.cachedContentName;
    }

    // Only attempt Gemini Context Caching if estimated tokens >= 32,768 (Gemini minimum threshold)
    const estimated = this.estimateTokens(fileEntry);
    if (estimated < this.minTokenThresholdForGeminiCache) {
      return null;
    }

    if (!geminiClient.caches || typeof geminiClient.caches.create !== "function") {
      return null;
    }

    try {
      const contents = [];
      if (fileEntry.textContent) {
        contents.push({
          role: "user",
          parts: [{ text: "[Sənəd konteksti: \"" + fileEntry.name + "\"]\n```\n" + fileEntry.textContent + "\n```" }],
        });
      } else if (fileEntry.data) {
        contents.push({
          role: "user",
          parts: [{ inlineData: { mimeType: fileEntry.mimeType, data: fileEntry.data } }],
        });
      }

      if (contents.length === 0) return null;

      const cacheResponse = await geminiClient.caches.create({
        model,
        config: {
          displayName: "marketify_doc_" + fileEntry.fileId.slice(0, 12),
          ttl: "3600s",
          contents,
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        },
      });

      if (cacheResponse && cacheResponse.name) {
        fileEntry.cachedContentName = cacheResponse.name;
        fileEntry.cachedContentExpiresAt = Date.now() + 3500 * 1000;
        return cacheResponse.name;
      }
    } catch (err) {
      // If CacheService is blocked (403), token count < 32k, or any network issue,
      // fail open and return null to use standard inline transmission.
      fileEntry.cachedContentName = null;
      return null;
    }

    return null;
  }

  deleteFile(fileId) {
    const entry = this.cache.get(fileId);
    if (entry) {
      if (entry.hash) this.hashToId.delete(entry.hash);
      this.cache.delete(fileId);
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [id, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.deleteFile(id);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.hashToId.clear();
  }
}

export const geminiFileCache = new GeminiFileCache();
