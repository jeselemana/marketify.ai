import assert from "node:assert/strict";
import test from "node:test";
import { AssessRequestSchema, GenerateRequestSchema } from "../src/domain/strategy.js";
import { LLMProviderError } from "../src/services/ai/llm-router.js";

test("strategy requests no longer accept a selectable model", () => {
  const assessment = AssessRequestSchema.parse({ brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı" });
  assert.equal("model" in assessment, false);

  const generation = GenerateRequestSchema.parse({
    brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı",
    idempotencyKey: "test-idempotency-key-12345",
  });
  assert.equal("model" in generation, false);
});

test("LLMProviderError retains provider metadata", () => {
  const error = new LLMProviderError("OpenAI xidməti əlçatan deyil.", {
    code: "AI_PROVIDER_UNAVAILABLE",
    status: 503,
    model: "gpt-5.6-terra",
    provider: "openai",
  });
  assert.equal(error.code, "AI_PROVIDER_UNAVAILABLE");
  assert.equal(error.status, 503);
  assert.equal(error.model, "gpt-5.6-terra");
  assert.equal(error.provider, "openai");
});
