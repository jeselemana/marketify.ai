import test from "node:test";
import assert from "node:assert/strict";
import { formatGeminiContents, generateGeminiAskResponse } from "../src/services/ai/gemini-client.js";
import { hasGeminiConfiguration, aiConfig } from "../src/services/ai/config.js";

test("formatGeminiContents correctly transforms messages to Gemini API format", () => {
  const input = [
    { role: "user", content: "Salam" },
    { role: "assistant", content: "Necə kömək edə bilərəm?" },
    { role: "user", content: "Marketinq planı nədir?" },
  ];

  const formatted = formatGeminiContents(input);

  assert.equal(formatted.length, 3);
  assert.deepEqual(formatted[0], { role: "user", parts: [{ text: "Salam" }] });
  assert.deepEqual(formatted[1], { role: "model", parts: [{ text: "Necə kömək edə bilərəm?" }] });
  assert.deepEqual(formatted[2], { role: "user", parts: [{ text: "Marketinq planı nədir?" }] });
});

test("formatGeminiContents merges consecutive messages with the same role", () => {
  const input = [
    { role: "user", content: "Birinci hissə" },
    { role: "user", content: "İkinci hissə" },
    { role: "assistant", content: "Cavab 1" },
    { role: "assistant", content: "Cavab 2" },
    { role: "user", content: "Növbəti sual" },
  ];

  const formatted = formatGeminiContents(input);

  assert.equal(formatted.length, 3);
  assert.equal(formatted[0].role, "user");
  assert.equal(formatted[0].parts[0].text, "Birinci hissə\n\nİkinci hissə");
  assert.equal(formatted[1].role, "model");
  assert.equal(formatted[1].parts[0].text, "Cavab 1\n\nCavab 2");
  assert.equal(formatted[2].role, "user");
  assert.equal(formatted[2].parts[0].text, "Növbəti sual");
});

test("formatGeminiContents drops leading orphaned model messages", () => {
  const input = [
    { role: "assistant", content: "Orphaned greeting" },
    { role: "user", content: "Sual" },
  ];

  const formatted = formatGeminiContents(input);

  assert.equal(formatted.length, 1);
  assert.equal(formatted[0].role, "user");
  assert.equal(formatted[0].parts[0].text, "Sual");
});

test("generateGeminiAskResponse throws AI_NOT_CONFIGURED when API key is missing", async () => {
  await assert.rejects(
    generateGeminiAskResponse({
      messages: [{ role: "user", content: "Test" }],
      apiKey: "",
    }),
    (err) => err.code === "AI_NOT_CONFIGURED" && err.status === 503,
  );
});

test("generateGeminiAskResponse throws INVALID_REQUEST when messages are empty", async () => {
  await assert.rejects(
    generateGeminiAskResponse({
      messages: [],
      apiKey: "test-key",
    }),
    (err) => err.code === "INVALID_REQUEST" && err.status === 400,
  );
});

test("hasGeminiConfiguration returns true when GEMINI_API_KEY is present", () => {
  assert.equal(typeof hasGeminiConfiguration(), "boolean");
  assert.equal(typeof aiConfig.geminiAskModel, "string");
  assert.equal(aiConfig.geminiAskModel, process.env.GEMINI_ASK_MODEL || "gemini-3.7-flash");
});
