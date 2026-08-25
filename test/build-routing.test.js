import test from "node:test";
import assert from "node:assert/strict";
import {
  AssessRequestSchema,
  GenerateRequestSchema,
  RefineRequestSchema,
  StrategyAssessmentSchema,
  StrategySchema,
  normalizeBuildModel,
} from "../src/domain/strategy.js";
import {
  assessmentResponseSchema,
  strategyResponseSchema,
  LLMProviderError,
} from "../src/services/ai/llm-router.js";

test("Build mode model normalization maps correctly to flagship engines", () => {
  assert.equal(normalizeBuildModel("gpt-5.6-terra"), "gpt-5.6-terra");
  assert.equal(normalizeBuildModel("core"), "gpt-5.6-terra");
  assert.equal(normalizeBuildModel(undefined), "gpt-5.6-terra");
  assert.equal(normalizeBuildModel(null), "gpt-5.6-terra");
  assert.equal(normalizeBuildModel(""), "gpt-5.6-terra");

  assert.equal(normalizeBuildModel("gemini-3.7-flash"), "gemini-3.7-flash");
  assert.equal(normalizeBuildModel("flash"), "gemini-3.7-flash");
  assert.equal(normalizeBuildModel("gemini"), "gemini-3.7-flash");
  assert.equal(normalizeBuildModel("GEMINI-3.7-FLASH"), "gemini-3.7-flash");
});

test("Build mode requests accept model parameter", () => {
  const assess = AssessRequestSchema.parse({
    brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı",
    model: "gemini-3.7-flash",
  });
  assert.equal(assess.model, "gemini-3.7-flash");

  const generate = GenerateRequestSchema.parse({
    brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı",
    idempotencyKey: "test-idempotency-key-12345",
    model: "gemini-3.7-flash",
  });
  assert.equal(generate.model, "gemini-3.7-flash");
});

test("Google OpenAPI responseSchemas are properly structured for tensor constrained decoding", () => {
  assert.equal(assessmentResponseSchema.type, "OBJECT");
  assert.ok(Array.isArray(assessmentResponseSchema.required));
  assert.ok(assessmentResponseSchema.properties.status.enum.includes("needs_clarification"));
  assert.ok(assessmentResponseSchema.properties.status.enum.includes("ready"));

  assert.equal(strategyResponseSchema.type, "OBJECT");
  assert.ok(strategyResponseSchema.properties.context.properties.business);
  assert.ok(strategyResponseSchema.properties.sections.items.properties.bullets);
});

test("LLMProviderError holds proper status, code, and provider", () => {
  const err = new LLMProviderError("Gemini xidməti hazırda yüksək yüklənmə altındadır (503).", {
    code: "AI_PROVIDER_UNAVAILABLE",
    status: 503,
    model: "gemini-3.7-flash",
    provider: "google",
  });

  assert.equal(err.name, "LLMProviderError");
  assert.equal(err.code, "AI_PROVIDER_UNAVAILABLE");
  assert.equal(err.status, 503);
  assert.equal(err.model, "gemini-3.7-flash");
  assert.equal(err.provider, "google");
});
