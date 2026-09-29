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

test("build mode config registers Opus 5.5 and Google Search Grounding with cost-control pricing", async () => {
  const { aiConfig } = await import("../src/services/ai/config.js");
  const { getPricingForModel, calculateEstimatedCost } = await import("../src/services/telemetry/pricing.js");

  assert.equal(aiConfig.strategyModel, "gemini-3.8-flash");
  assert.equal(aiConfig.opusModel, "claude-opus-5-5");
  assert.equal(aiConfig.enableBuildSearchGrounding, true);
  assert.equal(aiConfig.enableOpusOrchestration, true);

  const opusPricing = getPricingForModel("claude-opus-5-5");
  assert.equal(opusPricing.inputPerMillion, 15.00);
  assert.equal(opusPricing.outputPerMillion, 75.00);

  const cost = calculateEstimatedCost("claude-opus-5-5", 1000, 500);
  assert.ok(cost.costUsd > 0);
  assert.ok(cost.costAzn > 0);
  assert.equal(cost.totalTokens, 1500);
});

test("shouldTriggerOpusReasoning selectively invokes Opus only for high-reasoning tasks and skips simple formatting", async () => {
  const { shouldTriggerOpusReasoning } = await import("../src/services/ai/strategy-service.js");

  const origAnthropic = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";

  try {
    // 1. Skip on low-reasoning actions
    assert.equal(shouldTriggerOpusReasoning({ action: "shorten", brief: "Detailed strategy brief" }), false);
    assert.equal(shouldTriggerOpusReasoning({ action: "localize_azerbaijan", brief: "Detailed strategy brief" }), false);

    // 2. Trigger on high-reasoning actions
    assert.equal(shouldTriggerOpusReasoning({ action: "think_deeper", brief: "Strategic brief" }), true);
    assert.equal(shouldTriggerOpusReasoning({ action: "budget_optimize", brief: "Strategic brief" }), true);
    assert.equal(shouldTriggerOpusReasoning({ action: "make_practical", brief: "Strategic brief" }), true);

    // 3. Skip on trivial / too short intake (< 35 chars)
    assert.equal(shouldTriggerOpusReasoning({ brief: "Short" }), false);

    // 4. Skip on simple generic copywriting
    assert.equal(shouldTriggerOpusReasoning({ brief: "Sadəcə post yaz bizim butik üçün" }), false);

    // 5. Trigger on full business/marketing strategy intake
    assert.equal(
      shouldTriggerOpusReasoning({
        brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə və diferensiasiya planı",
      }),
      true,
    );
  } finally {
    if (origAnthropic !== undefined) {
      process.env.ANTHROPIC_API_KEY = origAnthropic;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  }
});

test("synthesizeStrategyWithOpusInsights unites Gemini execution and Opus strategic intelligence without schema violation", async () => {
  const { synthesizeStrategyWithOpusInsights } = await import("../src/services/ai/strategy-service.js");
  const { StrategySchema } = await import("../src/domain/strategy.js");

  const baseGeminiStrategy = {
    title: "EcoBottle Market Expansion",
    summary: "Comprehensive market expansion strategy for eco-friendly reusable bottles.",
    context: {
      business: "Manufacturing and retail of durable stainless steel insulated bottles.",
      objective: "Capture 15% local market share in the premium reusable bottle sector.",
      market: "Growing eco-conscious consumer segment in urban hubs.",
      targetAudience: "Urban professionals and fitness enthusiasts aged 22-40.",
    },
    sections: [
      {
        id: "market_analysis",
        title: "Bazar Analizi",
        summary: "Urban adoption trends.",
        content: "Detailed market analysis indicating strong shift toward sustainable lifestyle goods.",
        bullets: ["Point 1", "Point 2"],
      },
      {
        id: "acquisition_channels",
        title: "Müştəri Cəlbi Kanalları",
        summary: "Targeted digital and experiential channels.",
        content: "Performance marketing combined with community influencer seeding.",
        bullets: ["Direct to consumer", "Fitness studio pop-ups"],
      },
      {
        id: "operations",
        title: "Əməliyyat və İcra",
        summary: "Supply chain and fulfillment logic.",
        content: "Local warehousing and on-demand laser engraving personalization.",
        bullets: ["48h delivery guarantee"],
      },
    ],
    priorities: [
      {
        title: "Launch Digital DTC Storefront",
        description: "Set up high-converting landing page with 1-click checkout.",
        priority: "high",
      },
    ],
    actionPlan: [
      {
        phase: "Phase 1 - Foundation",
        actions: ["Establish supply chain agreements", "Launch digital portal"],
        expectedOutcome: "First 100 pilot orders delivered.",
      },
    ],
    kpis: [
      {
        name: "Monthly CAC",
        reason: "Monitor acquisition efficiency.",
        target: "Below 15 AZN",
      },
    ],
    risks: [
      {
        risk: "Supply chain delay in international freight",
        mitigation: "Maintain 30-day buffer inventory in local warehouse",
      },
    ],
    assumptions: ["Consumer demand for sustainability remains high"],
    nextSteps: [
      "Send brief to legal counsel today",
      "Open draft budget allocation spreadsheet today",
      "Draft interview questions and contact first 3 candidates within 48h",
      "Finalize 3 pilot packages and pricing within 48h",
      "Set up pilot offer and collect first test orders this week",
      "Review pilot order delivery and customer feedback this week",
    ],
  };

  const opusInsights = {
    positioningWedge: "Position not as generic hydration, but as an executive status accessory with lifetime warranty.",
    strategicDifferentiation: "Uncompromising thermal durability and zero-plastic bespoke engraving.",
    identifiedRisks: [
      {
        risk: "Low barrier to entry for cheap imported alternatives on marketplaces",
        mitigation: "Build community membership locking in free cap and seal replacements",
      },
    ],
    breakthroughPriorities: [
      {
        title: "Executive Corporate Gifting Partnerships",
        description: "Bypass retail clutter by signing corporate bulk gifting contracts for tech companies.",
      },
    ],
  };

  const unified = synthesizeStrategyWithOpusInsights(baseGeminiStrategy, opusInsights, "az");

  const validated = StrategySchema.parse(unified);
  assert.ok(validated);

  assert.match(validated.context.business, /Strateji Mövqelənmə:/);
  assert.match(validated.summary, /Strateji Fərqləndirici Üstünlük:/);

  assert.equal(validated.priorities.length, 2);
  assert.equal(validated.priorities[0].title, "Executive Corporate Gifting Partnerships");
  assert.equal(validated.priorities[0].priority, "high");

  assert.equal(validated.risks.length, 2);
  assert.ok(validated.risks.some((r) => r.risk.includes("cheap imported alternatives")));
});

test("callOpusVertexModel interacts gracefully and handles missing configuration without throwing", async () => {
  const { callOpusVertexModel, setTestOpusCaller } = await import("../src/services/ai/client.js");

  const result = await callOpusVertexModel({ system: "System", prompt: "Prompt" });
  assert.equal(result, null);

  setTestOpusCaller(async () => {
    return {
      text: JSON.stringify({
        positioningWedge: "Sharp wedge",
        strategicDifferentiation: "Pure differentiation",
      }),
      model: "claude-opus-5-5",
      provider: "vertex-anthropic",
      usage: { prompt_tokens: 150, completion_tokens: 60, total_tokens: 210 },
    };
  });

  try {
    const mockedRes = await callOpusVertexModel({ system: "Test", prompt: "Hello" });
    assert.equal(mockedRes.model, "claude-opus-5-5");
    assert.equal(mockedRes.provider, "vertex-anthropic");
    assert.equal(mockedRes.usage.total_tokens, 210);
    const parsed = JSON.parse(mockedRes.text);
    assert.equal(parsed.positioningWedge, "Sharp wedge");
  } finally {
    setTestOpusCaller(null);
  }
});

test("StrategySchema validates orchestration metadata and defaults correctly", async () => {
  const { StrategySchema } = await import("../src/domain/strategy.js");

  const validStrategy = {
    title: "Test Title",
    summary: "Test summary paragraph.",
    context: {
      business: "Business context",
      objective: "Objective context",
      market: "Market context",
      targetAudience: "Audience context",
    },
    sections: [
      { id: "s1", title: "Sec 1", summary: "Sum 1", content: "Content 1", bullets: ["b1"] },
      { id: "s2", title: "Sec 2", summary: "Sum 2", content: "Content 2", bullets: ["b2"] },
      { id: "s3", title: "Sec 3", summary: "Sum 3", content: "Content 3", bullets: ["b3"] },
    ],
    priorities: [{ title: "P1", description: "Desc 1", priority: "high" }],
    actionPlan: [{ phase: "Phase 1", actions: ["Act 1"], expectedOutcome: "Outcome 1" }],
    kpis: [{ name: "KPI 1", reason: "Reason 1", target: "10%" }],
    risks: [{ risk: "Risk 1", mitigation: "Mit 1" }],
    assumptions: ["Assumption 1"],
    nextSteps: ["Step 1"],
    orchestration: {
      models: ["Reasoning", "Core"],
      searchGrounded: true,
    },
  };

  const parsed = StrategySchema.parse(validStrategy);
  assert.equal(parsed.orchestration.models.length, 2);
  assert.equal(parsed.orchestration.models[0], "Reasoning");
  assert.equal(parsed.orchestration.models[1], "Core");
  assert.equal(parsed.orchestration.searchGrounded, true);

  // Without orchestration property, it remains optional
  const { orchestration: _removed, ...withoutOrch } = validStrategy;
  const parsedWithout = StrategySchema.parse(withoutOrch);
  assert.equal(parsedWithout.orchestration, undefined);
});

test("Frontend script.js safely renders orchestration metadata panel before assumptions with Core and Reasoning labels", async () => {
  const fs = (await import("node:fs/promises")).default;
  const path = (await import("node:path")).default;

  const scriptContent = await fs.readFile(path.resolve("public/script.js"), "utf-8");

  // 1. Panel is inserted before assumptions in buildStrategyView
  const closeoutIndex = scriptContent.indexOf("const closeout = buildNextStepsSection(strategy, isEn, false);");
  const metaPanelIndex = scriptContent.indexOf("const metaPanel = buildOrchestrationMetaPanel(strategy, isEn);");
  const assumptionsIndex = scriptContent.indexOf("if (strategy.assumptions && strategy.assumptions.length) {");

  assert.ok(closeoutIndex > 0, "buildNextStepsSection found");
  assert.ok(metaPanelIndex > closeoutIndex, "metaPanel is built after closeout");
  assert.ok(assumptionsIndex > metaPanelIndex, "assumptions panel is built after metaPanel");

  // 2. buildOrchestrationMetaPanel exists and uses safe DOM creation without innerHTML
  assert.ok(scriptContent.includes("function buildOrchestrationMetaPanel(strategy, isEn)"), "buildOrchestrationMetaPanel function exists");
  assert.ok(scriptContent.includes("element(\"div\", \"strategy-orchestration-panel\")"), "Creates safe panel container");
  assert.ok(!scriptContent.slice(metaPanelIndex, metaPanelIndex + 2500).includes("innerHTML"), "Zero innerHTML used in orchestration panel");

  // 3. Model display maps Gemini to Core and Opus to Reasoning, never exposing raw internal model names
  assert.ok(scriptContent.includes('displayModels.push("Core")'), "Maps to Core");
  assert.ok(scriptContent.includes('displayModels.push("Reasoning")'), "Maps to Reasoning");
  assert.match(scriptContent, /isSearchUsed[\s\S]*?(?:Used|İstifadə edilib)/, "Localizes web search used");
  assert.match(scriptContent, /(?:Not used|İstifadə edilməyib)/, "Localizes web search not used");
});
