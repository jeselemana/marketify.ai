import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { GenerateRequestSchema } from "../src/domain/strategy.js";
import {
  BUILD_MODELS,
  assertBuildModel,
  mapProviderError,
  openBuildStrategyStream,
  resolveBuildProvider,
} from "../src/services/ai/provider-router.js";

test("Build accepts only the two explicit provider model IDs", () => {
  assert.equal(assertBuildModel(BUILD_MODELS.FLASH), "gemini-3.7-flash");
  assert.equal(assertBuildModel(BUILD_MODELS.CORE), "gpt-5.6-terra");
  assert.throws(() => assertBuildModel("auto"), (error) => error.code === "AI_MODEL_UNSUPPORTED");
});

test("each Build model resolves to one exact provider without an auto route", () => {
  assert.deepEqual(resolveBuildProvider(BUILD_MODELS.FLASH), { provider: "google", model: "gemini-3.7-flash" });
  assert.deepEqual(resolveBuildProvider(BUILD_MODELS.CORE), { provider: "openai", model: "gpt-5.6-terra" });
});

test("Flash REST request uses the exact model and requested generation settings", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GOOGLE_API_KEY;
  let capturedUrl = "";
  let capturedOptions;
  process.env.GOOGLE_API_KEY = "test-key";
  globalThis.fetch = async (url, options) => {
    capturedUrl = String(url);
    capturedOptions = options;
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"{}"}]},"finishReason":"STOP"}]}\n\n'));
        controller.close();
      },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  };

  try {
    const stream = await openBuildStrategyStream({
      selectedModel: BUILD_MODELS.FLASH,
      instructions: "Return JSON.",
      input: "Build a strategy.",
      ownerId: "owner",
    });
    const events = [];
    for await (const event of stream.events) events.push(event);
    const requestBody = JSON.parse(capturedOptions.body);
    assert.match(capturedUrl, /models\/gemini-3\.7-flash:streamGenerateContent\?alt=sse$/);
    assert.equal(requestBody.generationConfig.thinkingConfig.thinkingBudget, 0);
    assert.equal(requestBody.generationConfig.maxOutputTokens, 8192);
    assert.equal(requestBody.generationConfig.temperature, 0.65);
    assert.deepEqual(events.at(-1), { type: "done", finishReason: "stop" });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = previousKey;
  }
});

test("generation payload requires selectedModel and rejects fallback aliases", () => {
  const base = {
    brief: "Build a launch strategy for a Baku retail brand.",
    answers: [],
    assumptions: [],
    idempotencyKey: "generation-123",
  };
  assert.equal(GenerateRequestSchema.parse({ ...base, selectedModel: BUILD_MODELS.FLASH }).selectedModel, BUILD_MODELS.FLASH);
  assert.throws(() => GenerateRequestSchema.parse({ ...base, selectedModel: "auto" }), z.ZodError);
  assert.throws(() => GenerateRequestSchema.parse(base), z.ZodError);
});

test("provider rate limits remain explicit and never request another route", () => {
  const upstream = new Error("quota exhausted");
  upstream.status = 429;
  const flashError = mapProviderError(upstream, "google");
  assert.equal(flashError.status, 429);
  assert.equal(flashError.code, "AI_RATE_LIMITED");
  assert.match(flashError.message, /Flash/);
});

test("provider service failures say that the selected model was not changed", () => {
  const upstream = new Error("service unavailable");
  upstream.status = 503;
  const coreError = mapProviderError(upstream, "openai");
  assert.equal(coreError.status, 503);
  assert.equal(coreError.code, "AI_SERVICE_UNAVAILABLE");
  assert.match(coreError.message, /avtomatik dəyişdirilmədi/);
});
