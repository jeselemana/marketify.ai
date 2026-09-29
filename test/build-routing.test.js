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

test("strategy router GET /:id returns single strategy, validates id, and enforces ownership", async (t) => {
  const os = (await import("node:os")).default;
  const path = (await import("node:path")).default;
  const fs = (await import("node:fs/promises")).default;
  const { FileStrategyRepository } = await import("../src/repositories/file-strategy-repository.js");
  const { createStrategyRouter, strategyErrorHandler } = await import("../src/http/strategy-router.js");

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-router-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const repository = new FileStrategyRepository(path.join(directory, "strategies.json"));
  const sampleData = {
    title: "Test Brand Strategy",
    summary: "A focused strategy summary.",
    context: {},
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  };

  const created = await repository.create(
    {
      clientSaveId: "save-1",
      brief: "Test brief",
      answers: [],
      strategy: sampleData,
      versions: [{ versionNumber: 1, data: sampleData, changeRequest: "Initial", createdAt: new Date().toISOString() }],
    },
    "owner-user-1",
  );

  const router = createStrategyRouter(repository);

  async function callRoute(method, url, ownerId) {
    return new Promise((resolve) => {
      let status = 200;
      const req = {
        method,
        url,
        baseUrl: "/api/strategy",
        params: {},
        ownerId,
        headers: {},
        on: () => {},
      };
      const res = {
        status(s) {
          status = s;
          return this;
        },
        json(data) {
          resolve({ status, body: data });
          return this;
        },
        setHeader() {},
      };
      router.handle(req, res, (err) => {
        if (err) {
          strategyErrorHandler(err, req, res, () => {
            resolve({ status: 500, body: { error: err.message } });
          });
        } else {
          resolve({ status: 404, body: { error: "Not matched" } });
        }
      });
    });
  }

  // 1. Valid ID & matching owner -> 200 with strategy
  const res1 = await callRoute("GET", `/${created.id}`, "owner-user-1");
  assert.equal(res1.status, 200);
  assert.equal(res1.body.strategy.id, created.id);
  assert.equal(res1.body.strategy.title, "Test Brand Strategy");
  assert.equal("ownerId" in res1.body.strategy, false);

  // 2. Non-existent UUID -> 404
  const res2 = await callRoute("GET", "/00000000-0000-0000-0000-000000000000", "owner-user-1");
  assert.equal(res2.status, 404);
  assert.equal(res2.body.code, "NOT_FOUND");

  // 3. Different owner -> 404
  const res3 = await callRoute("GET", `/${created.id}`, "owner-user-2");
  assert.equal(res3.status, 404);
  assert.equal(res3.body.code, "NOT_FOUND");

  // 4. Invalid UUID format -> 400
  const res4 = await callRoute("GET", "/invalid-id", "owner-user-1");
  assert.equal(res4.status, 400);
  assert.equal(res4.body.code, "VALIDATION_ERROR");
});

test("strategy router POST /generate returns existing saved strategy if clientSaveId exists", async (t) => {
  const os = (await import("node:os")).default;
  const path = (await import("node:path")).default;
  const fs = (await import("node:fs/promises")).default;
  const { FileStrategyRepository } = await import("../src/repositories/file-strategy-repository.js");
  const { createStrategyRouter, strategyErrorHandler } = await import("../src/http/strategy-router.js");

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-idempotent-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const repository = new FileStrategyRepository(path.join(directory, "strategies.json"));
  const sampleData = {
    title: "Pre-existing Strategy",
    summary: "A focused strategy summary.",
    context: {},
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  };

  await repository.create(
    {
      clientSaveId: "idempotency-key-xyz",
      brief: "Test brief for pre-existing",
      answers: [],
      strategy: sampleData,
      versions: [{ versionNumber: 1, data: sampleData, changeRequest: "Initial", createdAt: new Date().toISOString() }],
    },
    "owner-user-1",
  );

  const router = createStrategyRouter(repository);

  const req = {
    method: "POST",
    url: "/generate",
    baseUrl: "/api/strategy",
    body: {
      brief: "Test brief for pre-existing",
      idempotencyKey: "idempotency-key-xyz",
      answers: [],
    },
    ownerId: "owner-user-1",
    headers: {},
    on: () => {},
  };

  const response = await new Promise((resolve) => {
    let statusCode = 200;
    const res = {
      status(s) {
        statusCode = s;
        return this;
      },
      json(data) {
        resolve({ status: statusCode, body: data });
        return this;
      },
      setHeader() {},
    };

    router.handle(req, res, (err) => {
      if (err) {
        strategyErrorHandler(err, req, res, () => resolve({ status: 500, body: { error: err.message } }));
      } else {
        resolve({ status: 404, body: { error: "Not matched" } });
      }
    });
  });

  assert.equal(response.status, 200);
  assert.equal(response.body?.strategy?.title, "Pre-existing Strategy");
});

test("build mode defaults to gemini-3.8-flash with High thinking and gpt-5.6-terra fallback", async () => {
  const { aiConfig } = await import("../src/services/ai/config.js");
  assert.equal(aiConfig.strategyModel, "gemini-3.8-flash");
  assert.equal(aiConfig.strategyFallbackModel, "gpt-5.6-terra");
  assert.equal(aiConfig.strategyThinkingLevel, "HIGH");
});

test("formatGeminiResponseSchema transforms StrategyAssessmentSchema and StrategySchema for Vertex AI", async () => {
  const { formatGeminiResponseSchema } = await import("../src/services/ai/llm-router.js");
  const { StrategyAssessmentSchema, StrategySchema } = await import("../src/domain/strategy.js");

  const assessmentSchema = formatGeminiResponseSchema(StrategyAssessmentSchema, "strategy_assessment");
  assert.equal(assessmentSchema.type, "object");
  assert.equal(Array.isArray(assessmentSchema.required), true);
  assert.equal("$ref" in assessmentSchema, false);
  assert.equal("definitions" in assessmentSchema, false);
  assert.equal(assessmentSchema.properties.status.type, "string");

  const strategySchema = formatGeminiResponseSchema(StrategySchema, "helmer_strategy");
  assert.equal(strategySchema.type, "object");
  assert.equal(Array.isArray(strategySchema.required), true);
  assert.equal("$ref" in strategySchema, false);
  assert.equal("definitions" in strategySchema, false);
  assert.equal(strategySchema.properties.title.type, "string");
  assert.equal(strategySchema.properties.sections.type, "array");
  assert.equal(strategySchema.properties.sections.items.type, "object");
  assert.equal(strategySchema.properties.actionPlan.items.properties.actions.type, "array");
});

test("strategy schemas accept optional language property and preserve model separation", async () => {
  const { AssessRequestSchema, GenerateRequestSchema, RefineRequestSchema } = await import("../src/domain/strategy.js");

  const enAssess = AssessRequestSchema.parse({
    brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı",
    language: "en",
  });
  assert.equal(enAssess.language, "en");
  assert.equal("model" in enAssess, false);

  const azAssess = AssessRequestSchema.parse({
    brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı",
    language: "az",
  });
  assert.equal(azAssess.language, "az");

  const enGen = GenerateRequestSchema.parse({
    brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı",
    idempotencyKey: "test-idempotency-key-en",
    language: "en",
  });
  assert.equal(enGen.language, "en");
});

test("detectTargetMarket accurately distinguishes Azerbaijan market signals from global markets", async () => {
  const { detectTargetMarket } = await import("../src/services/ai/prompts.js");

  // Local Azerbaijan scenarios
  assert.equal(
    detectTargetMarket({ brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı" }),
    "azerbaijan",
  );
  assert.equal(
    detectTargetMarket({ brief: "Biz Sumqayıtda mebel sexi açırıq, 2500 AZN büdcə ilə satışları artırmaq istəyirik" }),
    "azerbaijan",
  );
  assert.equal(
    detectTargetMarket({
      brief: "Gözəllik salonu üçün marketinq planı",
      answers: [{ question: "Ödəniş üsulu və vergi?", answer: "m10, Birbank və VÖEN ilə fiziki şəxs kimi işləyirik" }],
    }),
    "azerbaijan",
  );
  assert.equal(
    detectTargetMarket({ brief: "Yerli istehlakçılar üçün daxili bazarda orqanik bal satışı" }),
    "azerbaijan",
  );

  // Global / International scenarios
  assert.equal(
    detectTargetMarket({ brief: "A B2B SaaS startup targeting US enterprise companies in California with $50k ARR" }),
    "global",
  );
  assert.equal(
    detectTargetMarket({ brief: "Launching a luxury cosmetics brand in Germany, France, and the UK with EUR pricing" }),
    "global",
  );
  assert.equal(
    detectTargetMarket({ brief: "Worldwide recruitment agency for remote engineers in North America" }),
    "global",
  );

  // Unspecified / Auto scenario
  assert.equal(
    detectTargetMarket({ brief: "How to improve product onboarding and reduce customer churn" }),
    "auto",
  );
});

test("buildStrategyPrompt assembles [LOCAL_AZ_MODE] for Azerbaijan and preserves global framework for foreign markets", async () => {
  const { buildStrategyPrompt, STRATEGY_PROMPT } = await import("../src/services/ai/prompts.js");

  // 1. Azerbaijan prompt includes local directive and core local laws
  const azPrompt = buildStrategyPrompt({
    brief: "Bakıda kofe mağazası açırıq, büdcəmiz 1000 AZN",
  });
  assert.match(azPrompt, /\[MARKET CONTEXT DIRECTIVE: Target market is detected as AZERBAIJAN/);
  assert.match(azPrompt, /\[LOCAL_AZ_MODE\]/);
  assert.match(azPrompt, /Instagram/);
  assert.match(azPrompt, /TikTok/);
  assert.match(azPrompt, /AZN/);
  assert.match(azPrompt, /VÖEN/);
  assert.match(azPrompt, /İlk 7 gün/);
  assert.match(azPrompt, /İlk 30 gün/);

  // 2. Global prompt includes global directive and does not force local AZ constraints
  const globalPrompt = buildStrategyPrompt({
    brief: "A direct-to-consumer athletic wear brand targeting customers across the United States and Europe",
  });
  assert.match(globalPrompt, /\[MARKET CONTEXT DIRECTIVE: Target market is detected as GLOBAL \/ INTERNATIONAL/);
  assert.match(globalPrompt, /Do NOT apply local Azerbaijani market constraints/);

  // 3. Auto prompt preserves dynamic detection instruction
  const autoPrompt = buildStrategyPrompt({
    brief: "Improving customer retention and repeat purchase rate",
  });
  assert.match(autoPrompt, /\[MARKET CONTEXT DIRECTIVE: Dynamic detection required/);

  // 4. STRATEGY_PROMPT contains all mandated rules and forbidden clichés
  assert.match(STRATEGY_PROMPT, /İstehlakçı Psixologiyası və Satış Vərdişləri/);
  assert.match(STRATEGY_PROMPT, /Şəxsi Güvən və Vizual Nüfuz/);
  assert.match(STRATEGY_PROMPT, /word of mouth/);
  assert.match(STRATEGY_PROMPT, /Instagram/);
  assert.match(STRATEGY_PROMPT, /TikTok/);
  assert.match(STRATEGY_PROMPT, /LinkedIn/);
  assert.match(STRATEGY_PROMPT, /Qiymət üçün direktə yazın/);
  assert.match(STRATEGY_PROMPT, /Apple Pay/);
  assert.match(STRATEGY_PROMPT, /m10/);
  assert.match(STRATEGY_PROMPT, /Birbank/);
  assert.match(STRATEGY_PROMPT, /Fizi(?:ki)? şəxs \/ VÖEN/i);
  assert.match(STRATEGY_PROMPT, /MMC/);
  assert.match(STRATEGY_PROMPT, /Sadələşdirilmiş vergi/);
  assert.match(STRATEGY_PROMPT, /İlk 7 gün/);
  assert.match(STRATEGY_PROMPT, /İlk 30 gün/);
  assert.match(STRATEGY_PROMPT, /bu bir oyun dəyişdiricidir/);
});

test("buildAssessorPrompt and buildRefinementPrompt correctly apply context-aware directives", async () => {
  const { buildAssessorPrompt, buildRefinementPrompt, getRefinementInstruction } = await import("../src/services/ai/prompts.js");

  // Assessor prompt
  const azAssessor = buildAssessorPrompt({ brief: "Bakıda uşaq bağçası açırıq" });
  assert.match(azAssessor, /\[MARKET CONTEXT DIRECTIVE: Target market is AZERBAIJAN/);
  assert.match(azAssessor, /Instagram\/TikTok/);

  const globalAssessor = buildAssessorPrompt({ brief: "US SaaS analytics tool" });
  assert.match(globalAssessor, /\[MARKET CONTEXT DIRECTIVE: Target market is GLOBAL \/ INTERNATIONAL/);

  // Refinement prompt
  const azRefinement = buildRefinementPrompt({ brief: "Bakı restoranı", answers: [] });
  assert.match(azRefinement, /\[MARKET CONTEXT DIRECTIVE: The active strategy is for AZERBAIJAN/);

  const globalRefinement = buildRefinementPrompt({ brief: "Global developer tools in Europe", answers: [] });
  assert.match(globalRefinement, /\[MARKET CONTEXT DIRECTIVE: The active strategy is for GLOBAL \/ INTERNATIONAL/);

  // localize_azerbaijan instruction verification
  const localAzInst = getRefinementInstruction("localize_azerbaijan");
  assert.match(localAzInst, /\[LOCAL_AZ_MODE\]/);
  assert.match(localAzInst, /Instagram DM/);
  assert.match(localAzInst, /AZN/);
  assert.match(localAzInst, /m10/);
  assert.match(localAzInst, /İlk 7 gün/);
});



