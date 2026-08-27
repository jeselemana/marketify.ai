import test from "node:test";
import assert from "node:assert/strict";
import { GeminiFileCache } from "../src/services/ai/gemini-file-cache.js";

test("GeminiFileCache stores files and generates deterministic fileId for identical content", () => {
  const cache = new GeminiFileCache({ ttlMs: 10000 });
  const file1 = { name: "report.pdf", size: 5000, mimeType: "application/pdf", data: "base64payload123" };
  const id1 = cache.storeFile(file1);
  assert.ok(id1.startsWith("gfc_"));

  // Storing identical content returns same fileId
  const id2 = cache.storeFile({ ...file1 });
  assert.equal(id1, id2);

  const retrieved = cache.getFile(id1);
  assert.equal(retrieved.name, "report.pdf");
  assert.equal(retrieved.data, "base64payload123");
});

test("GeminiFileCache resolves lightweight file metadata with stored data", () => {
  const cache = new GeminiFileCache({ ttlMs: 10000 });
  const fileId = cache.storeFile({
    name: "data.csv",
    size: 200,
    type: "text/csv",
    textContent: "id,name,price\n1,apple,2.5",
  });

  // Client sends only fileId and name on follow-up turn
  const resolved = cache.resolveFile({ fileId, name: "data.csv", size: 200 });
  assert.ok(resolved);
  assert.equal(resolved.textContent, "id,name,price\n1,apple,2.5");
});

test("GeminiFileCache token estimation works for text and binary files", () => {
  const cache = new GeminiFileCache();
  const smallText = { textContent: "Hello world" };
  assert.equal(cache.estimateTokens(smallText), 3);

  const largeText = { textContent: "A".repeat(160000) };
  assert.equal(cache.estimateTokens(largeText), 40000);

  const binary = { data: "A".repeat(120000) }; // ~90KB
  assert.equal(cache.estimateTokens(binary), 3000);
});

test("GeminiFileCache getOrCreateGeminiCachedContent safely returns null for small files or blocked API", async () => {
  const cache = new GeminiFileCache();
  const file = { name: "small.png", size: 100, data: "smallBase64" };

  // For small files (<32k tokens), returns null without calling gemini.caches.create
  const mockGemini = { caches: { create: async () => { throw new Error("Should not be called"); } } };
  const result = await cache.getOrCreateGeminiCachedContent({
    geminiClient: mockGemini,
    model: "gemini-3.7-flash",
    file,
  });
  assert.equal(result, null);
});

test("GeminiFileCache cleans up expired entries after TTL", async () => {
  const cache = new GeminiFileCache({ ttlMs: 10 }); // 10ms TTL
  const id = cache.storeFile({ name: "temp.txt", textContent: "temporary" });
  assert.ok(cache.getFile(id));

  await new Promise((r) => setTimeout(r, 25));
  cache.cleanup();
  assert.equal(cache.getFile(id), null);
});
