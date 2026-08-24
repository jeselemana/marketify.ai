import test from "node:test";
import assert from "node:assert/strict";
import {
  AssessRequestSchema,
  GenerateRequestSchema,
  RefineRequestSchema,
  normalizeBuildModel,
  validBuildModels,
} from "../src/domain/strategy.js";
import {
  LLMProviderError,
  routeStructuredGeneration,
  streamGeminiContent,
  streamOpenAIContent,
} from "../src/services/ai/llm-router.js";
import { aiConfig } from "../src/services/ai/config.js";

test("Build mode model normalization and defaults", () => {
  assert.equal(normalizeBuildModel("flash"), "gemini-3.7-flash");
  assert.equal(normalizeBuildModel("gemini-3.7-flash"), "gemini-3.7-flash");
  assert.equal(normalizeBuildModel("core"), "gpt-5.6-terra");
  assert.equal(normalizeBuildModel("gpt-5.6-terra"), "gpt-5.6-terra");
  assert.equal(normalizeBuildModel("terra"), "gpt-5.6-terra");
  assert.equal(normalizeBuildModel(""), "gpt-5.6-terra");
  assert.equal(normalizeBuildModel(undefined), "gpt-5.6-terra");
  assert.deepEqual(validBuildModels, ["gemini-3.7-flash", "gpt-5.6-terra", "flash", "core"]);
});

test("Build mode request schemas validate model parameter with proper defaults", () => {
  // AssessRequestSchema
  const assessDefault = AssessRequestSchema.parse({ brief: "Start a B2B SaaS in Baku with 5k budget" });
  assert.equal(assessDefault.model, "gpt-5.6-terra");
  const assessFlash = AssessRequestSchema.parse({ brief: "Start a B2B SaaS in Baku with 5k budget", model: "gemini-3.7-flash" });
  assert.equal(assessFlash.model, "gemini-3.7-flash");

  // GenerateRequestSchema
  const genDefault = GenerateRequestSchema.parse({
    brief: "Start a B2B SaaS in Baku with 5k budget",
    idempotencyKey: "test-idempotency-12345",
  });
  assert.equal(genDefault.model, "gpt-5.6-terra");
  const genFlash = GenerateRequestSchema.parse({
    brief: "Start a B2B SaaS in Baku with 5k budget",
    idempotencyKey: "test-idempotency-12345",
    model: "gemini-3.7-flash",
  });
  assert.equal(genFlash.model, "gemini-3.7-flash");

  // RefineRequestSchema
  const dummyStrategy = {
    title: "Test",
    summary: "Summary",
    context: { business: "B", objective: "O", market: "M", targetAudience: "T" },
    sections: [
      { id: "s1", title: "T1", summary: "S1", content: "C1", bullets: ["b1"] },
      { id: "s2", title: "T2", summary: "S2", content: "C2", bullets: ["b2"] },
      { id: "s3", title: "T3", summary: "S3", content: "C3", bullets: ["b3"] },
    ],
    priorities: [{ title: "P1", description: "D1", priority: "high" }],
    actionPlan: [{ phase: "Phase 1", actions: ["Act 1"], expectedOutcome: "Outcome" }],
    kpis: [{ name: "K1", reason: "R1", target: "T1" }],
    risks: [{ risk: "Risk", mitigation: "Mit" }],
    assumptions: ["A1"],
    nextSteps: ["N1"],
  };

  const refineDefault = RefineRequestSchema.parse({
    brief: "Start a B2B SaaS in Baku with 5k budget",
    strategy: dummyStrategy,
    action: "shorten",
  });
  assert.equal(refineDefault.model, "gpt-5.6-terra");
  const refineFlash = RefineRequestSchema.parse({
    brief: "Start a B2B SaaS in Baku with 5k budget",
    strategy: dummyStrategy,
    action: "shorten",
    model: "gemini-3.7-flash",
  });
  assert.equal(refineFlash.model, "gemini-3.7-flash");
});

test("Zero silent fallback: Gemini errors return Gemini provider info and never fallback to OpenAI", async () => {
  const origKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(
      streamGeminiContent({ instructions: "test", input: "test" }),
      (err) => {
        assert.ok(err instanceof LLMProviderError);
        assert.equal(err.code, "AI_NOT_CONFIGURED");
        assert.equal(err.provider, "google");
        assert.equal(err.model, "gemini-3.7-flash");
        return true;
      },
    );
  } finally {
    if (origKey) process.env.GEMINI_API_KEY = origKey;
  }
});

test("Zero silent fallback: OpenAI errors return OpenAI provider info and never fallback to Gemini", async () => {
  const origKey = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(
      streamOpenAIContent({ model: "gpt-5.6-terra", instructions: "test", input: "test" }),
      (err) => {
        assert.ok(err instanceof LLMProviderError);
        assert.equal(err.code, "AI_NOT_CONFIGURED");
        assert.equal(err.provider, "openai");
        assert.equal(err.model, "gpt-5.6-terra");
        return true;
      },
    );
  } finally {
    if (origKey) process.env.OPENAI_API_KEY = origKey;
  }
});

test("LLMProviderError holds proper status codes and error structures", () => {
  const rateLimitErr = new LLMProviderError("Rate limit exceeded", {
    code: "AI_RATE_LIMITED",
    status: 429,
    model: "gemini-3.7-flash",
    provider: "google",
  });
  assert.equal(rateLimitErr.status, 429);
  assert.equal(rateLimitErr.code, "AI_RATE_LIMITED");
  assert.equal(rateLimitErr.model, "gemini-3.7-flash");
  assert.equal(rateLimitErr.provider, "google");
});
