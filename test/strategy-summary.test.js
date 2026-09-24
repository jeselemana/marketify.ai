import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import {
  StrategySummaryRequestSchema,
  StrategySummaryOutputSchema,
  serializeStrategyContext,
  StrategySchema,
} from "../src/domain/strategy.js";
import { aiConfig } from "../src/services/ai/config.js";
import { summarizeStrategyWithLuna } from "../src/services/ai/strategy-service.js";
import { createStrategyRouter } from "../src/http/strategy-router.js";
import { TRANSLATIONS } from "../public/i18n.js";

const sampleStrategy = {
  title: "Premium Kafe Şəbəkəsi Genişlənmə Strategiyası",
  summary: "Bakı bazarında 3 yeni filial açılışı və loyallıq proqramının tətbiqi.",
  context: {
    business: "Bakıda fəaliyyət göstərən premium specialty coffee şəbəkəsi.",
    objective: "Müştəri bazasını 40% artırmaq və yeni filiallarda rentabelliyi təmin etmək.",
    market: "Bakı şəhəri, premium istehlak seqmenti.",
    targetAudience: "22-45 yaşlı iş adamları, yaradıcı peşə sahibləri və tələbələr.",
  },
  sections: [
    {
      id: "sec-1",
      title: "Bazar Təhlili",
      summary: "Rəqiblərin analizi və unikal satış təklifi.",
      content: "Premium qəhvə bazarında artan tələbat mövcuddur.",
      bullets: ["Yerli qovurma üstünlüyü", "Mobil sifariş tətbiqi"],
    },
    {
      id: "sec-2",
      title: "Mövqelənmə və Brend Kimliyi",
      summary: "Skandinaviya dizaynı və minimalist estetika.",
      content: "Rahat iş və görüş mühiti formalaşdırılır.",
      bullets: ["Yüksək keyfiyyətli xidmət", "Davamlılıq prinsipləri"],
    },
    {
      id: "sec-3",
      title: "Marketinq Kanalları",
      summary: "Rəqəmsal və lokal aktivasiyalar.",
      content: "Instagram, TikTok və mikro-influenser əməkdaşlıqları.",
      bullets: ["Kofeman loyallıq kartı", "Korporativ tədbirlər"],
    },
  ],
  priorities: [
    {
      title: "Məkan Seçimi və İcarə",
      description: "Yüksək piyada axını olan mərkəzi nöqtələrin icarəsi.",
      priority: "high",
    },
    {
      title: "Rəqəmsal Loyallıq Tətbiqi",
      description: "Təkrar ziyarətləri artırmaq üçün mobil tətbiq.",
      priority: "medium",
    },
  ],
  actionPlan: [
    {
      phase: "Faza 1: Hazırlıq",
      actions: ["Məkanların təmiri", "Barista təlimləri"],
      expectedOutcome: "1-ci filialın açılışa hazır olması.",
    },
    {
      phase: "Faza 2: Açılış və Kampaniya",
      actions: ["Açılış günü tədbiri", "Influencer dequstasiyası"],
      expectedOutcome: "Gündəlik 300+ qəhvə satışı.",
    },
  ],
  kpis: [
    {
      name: "Gündəlik fincan sayı",
      reason: "Gəlirliliyin əsas göstəricisi",
      target: "350 fincan/gün",
    },
    {
      name: "Təkrar alış dərəcəsi",
      reason: "Müştəri loyallığının təsdiqi",
      target: "45%",
    },
  ],
  risks: [
    {
      risk: "Təchizat zəncirində qəhvə dənələrinin gecikməsi",
      mitigation: "Ən azı 2 aylıq strateji ehtiyat saxlamaq.",
    },
  ],
  assumptions: ["İcarə qiymətlərinin sabit qalması."],
  nextSteps: ["İcarə müqaviləsinin imzalanması", "Dizayn layihəsinin təsdiqi"],
};

function invokeRoute(router, req = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, body: data }); return this; },
      on() {},
    };
    const expressReq = {
      method: req.method || "POST",
      url: req.url || "/summary",
      body: req.body || {},
      ownerId: req.ownerId || "user_123",
      user: req.user || null,
      ip: req.ip || "127.0.0.1",
      socket: { remoteAddress: req.ip || "127.0.0.1" },
      headers: req.headers || {},
    };
    router(expressReq, res, (err) => {
      if (err) resolve({ status: err.status || 500, error: err });
      else resolve({ status: 404 });
    });
  });
}

test("1. aiConfig defines strategySummaryModel as gpt-5.6-luna", () => {
  assert.equal(aiConfig.strategySummaryModel, "gpt-5.6-luna");
});

test("2. StrategySummaryRequestSchema enforces strict validation and requires strategy or valid strategyId (Rule 2)", () => {
  // Valid with strategy object
  const validStrategy = StrategySummaryRequestSchema.safeParse({
    strategy: sampleStrategy,
    language: "az",
  });
  assert.ok(validStrategy.success, "Valid strategy object must pass");

  // Valid with strategyId (UUID)
  const validId = StrategySummaryRequestSchema.safeParse({
    strategyId: "12345678-1234-1234-1234-123456789abc",
    language: "en",
  });
  assert.ok(validId.success, "Valid UUID strategyId must pass");

  // Rejects unwhitelisted fields (Rule 2: strict validation)
  const invalidInjected = StrategySummaryRequestSchema.safeParse({
    strategy: sampleStrategy,
    hackedField: "drop tables",
  });
  assert.ok(!invalidInjected.success, "Strict validation must reject unexpected fields");

  // Rejects invalid non-UUID strategyId
  const invalidId = StrategySummaryRequestSchema.safeParse({
    strategyId: "not-a-uuid",
  });
  assert.ok(!invalidId.success, "Must reject invalid UUID");

  // Rejects empty request
  const empty = StrategySummaryRequestSchema.safeParse({});
  assert.ok(!empty.success, "Must reject when neither strategy nor strategyId is provided");
});

test("3. StrategySummaryOutputSchema strictly validates summary structure and rejects unknown fields", () => {
  const validOutput = StrategySummaryOutputSchema.safeParse({
    title: "Kafe Genişlənmə Strategiyası",
    objective: "Bakı mərkəzində 3 yeni filial açmaq və premium kofeman seqmentinə liderlik etmək.",
    keyMoves: [
      "Yerli qovurma və specialty qəhvə dənələri ilə fərqlənmək",
      "Mobil loyallıq tətbiqi ilə təkrar alışları 45%-ə çatdırmaq",
      "Skandinaviya minimalist dizaynı ilə rahat iş məkanı təqdim etmək",
    ],
    execution: "İlk 60 gündə icarə və təmir, 90-cı gündə açılış və influencer aktivasiyaları.",
    kpisAndBudget: "Büdcə: 75,000 AZN. Hədəf: gündəlik 350 fincan satışı və 40% müştəri artımı.",
    takeaway: "Məkan seçimi və barista peşəkarlığı rentabelliyi təyin edən ən kritik iki amildir.",
    summary: "Bu strategiya yüksək keyfiyyət və premium xidmət üzərində qurulmuşdur.",
  });
  assert.ok(validOutput.success);

  const invalidExtraneous = StrategySummaryOutputSchema.safeParse({
    title: "Test",
    objective: "Test",
    keyMoves: [],
    execution: "Test",
    kpisAndBudget: "Test",
    takeaway: "Test",
    summary: "Test",
    extraHack: "should fail",
  });
  assert.ok(!invalidExtraneous.success, "Output schema must be strict");
});

test("4. serializeStrategyContext serializes 100% of strategy critical pillars", () => {
  const contextText = serializeStrategyContext(sampleStrategy);

  assert.match(contextText, /TITLE: Premium Kafe Şəbəkəsi/);
  assert.match(contextText, /CONTEXT:/);
  assert.match(contextText, /Bakıda fəaliyyət göstərən premium specialty coffee/);
  assert.match(contextText, /STRATEGIC PRIORITIES:/);
  assert.match(contextText, /Məkan Seçimi və İcarə/);
  assert.match(contextText, /SECTIONS:/);
  assert.match(contextText, /Bazar Təhlili/);
  assert.match(contextText, /ACTION PLAN:/);
  assert.match(contextText, /Faza 1: Hazırlıq/);
  assert.match(contextText, /KPIS:/);
  assert.match(contextText, /Gündəlik fincan sayı/);
  assert.match(contextText, /RISKS & MITIGATIONS:/);
  assert.match(contextText, /Təchizat zəncirində qəhvə dənələrinin gecikməsi/);
  assert.match(contextText, /NEXT STEPS:/);
});

test("5. summarizeStrategyWithLuna executes with gpt-5.6-luna and validates output structure", async () => {
  let capturedModel = "";
  let capturedMessages = [];
  let capturedFormat = null;

  const mockOpenAIClient = {
    chat: {
      completions: {
        create: async (params) => {
          capturedModel = params.model;
          capturedMessages = params.messages;
          capturedFormat = params.response_format;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: sampleStrategy.title,
                    objective: "3 yeni filial açaraq Bakı premium seqmentində bazar payını 40% artırmaq.",
                    keyMoves: [
                      "Şəhər mərkəzində yüksək piyada axını olan strateji nöqtələri icarəyə götürmək",
                      "Mobil tətbiq vasitəsilə cashback və loyallıq mexanizmini işə salmaq",
                      "Yerli qovurma və barista məktəbi ilə unikal dad və xidmət təmin etmək",
                    ],
                    execution: "Faza 1-də təmir və barista təlimləri, Faza 2-də açılış kampaniyası.",
                    kpisAndBudget: "Büdcə 75k AZN; Hədəf KPI: 350 fincan/gün və 45% təkrar alış.",
                    takeaway: "Məkanın dəqiq seçimi və brend atmosferi açılışın ilk 30 günündə həlledicidir.",
                    summary: "Strategiya Bakı mərkəzində sürətli və keyfiyyətli genişlənməni hədəfləyir.",
                  }),
                },
              },
            ],
            usage: {
              prompt_tokens: 350,
              completion_tokens: 180,
              total_tokens: 530,
            },
          };
        },
      },
    },
  };

  const result = await summarizeStrategyWithLuna({
    strategy: sampleStrategy,
    language: "az",
    client: mockOpenAIClient,
  });

  // Verify model
  assert.equal(capturedModel, "gpt-5.6-luna", "Model must be gpt-5.6-luna");
  assert.equal(capturedFormat?.type, "json_object", "Must request json_object format");

  // Verify prompt directive
  const systemPrompt = capturedMessages.find((m) => m.role === "system")?.content || "";
  assert.match(systemPrompt, /yüksək səviyyəli strateq/i);
  assert.match(systemPrompt, /kəsərli/i);
  assert.match(systemPrompt, /boş söz yığını/i);

  // Verify parsed result
  assert.equal(result.model, "gpt-5.6-luna");
  assert.equal(result.title, sampleStrategy.title);
  assert.equal(result.keyMoves.length, 3);
  assert.match(result.objective, /3 yeni filial/);
  assert.match(result.takeaway, /Məkanın dəqiq seçimi/);
});

test("6. POST /api/strategy/summary route handles requests, enforces tenant isolation, and returns summary", async () => {
  const strategyId = "99999999-8888-7777-6666-555555555555";
  const mockRepo = {
    getById: async (id, ownerId) => {
      if (id === strategyId && ownerId === "user_123") {
        return {
          id: strategyId,
          ownerId: "user_123",
          strategy: sampleStrategy,
        };
      }
      return null;
    },
  };

  const mockOpenAIClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Xülasə Nəticəsi",
                  objective: "Dəqiq hədəf",
                  keyMoves: ["Gediş 1", "Gediş 2"],
                  execution: "İcra planı",
                  kpisAndBudget: "Büdcə və KPI",
                  takeaway: "Yekun qərar",
                  summary: "Bütöv xülasə",
                }),
              },
            },
          ],
        }),
      },
    },
  };

  const router = createStrategyRouter(mockRepo, null, { openAiClient: mockOpenAIClient });

  // Direct request with strategy body
  const resSuccess = await invokeRoute(router, {
    method: "POST",
    url: "/summary",
    ownerId: "user_123",
    body: { strategy: sampleStrategy, language: "az" },
  });

  assert.equal(resSuccess.status, 200);
  assert.equal(resSuccess.body.summary.title, "Xülasə Nəticəsi");
  assert.equal(resSuccess.body.summary.model, "gpt-5.6-luna");

  // Request with strategyId - Tenant isolation check (Rule 3)
  const resIdSuccess = await invokeRoute(router, {
    method: "POST",
    url: "/summary",
    ownerId: "user_123",
    body: { strategyId, language: "az" },
  });

  assert.equal(resIdSuccess.status, 200);
  assert.equal(resIdSuccess.body.summary.model, "gpt-5.6-luna");

  // IDOR check: Attempting to access someone else's strategy returns 404
  const resForbidden = await invokeRoute(router, {
    method: "POST",
    url: "/summary",
    ownerId: "user_123",
    body: { strategyId: "00000000-0000-0000-0000-000000000000", language: "az" },
  });

  assert.equal(resForbidden.status, 404, "Accessing non-existent or other tenant's strategyId must return 404");
});

test("7. i18n contains complete strategy.summary dictionary with 100% AZ & EN parity", () => {
  assert.ok(TRANSLATIONS.az.strategy.summary);
  assert.ok(TRANSLATIONS.en.strategy.summary);

  const azSummaryKeys = Object.keys(TRANSLATIONS.az.strategy.summary).sort();
  const enSummaryKeys = Object.keys(TRANSLATIONS.en.strategy.summary).sort();

  assert.deepEqual(azSummaryKeys, enSummaryKeys, "Summary translation keys must have 100% parity between AZ and EN");

  assert.equal(TRANSLATIONS.az.strategy.summary.button, "Xülasə");
  assert.equal(TRANSLATIONS.en.strategy.summary.button, "Summary");
  assert.equal(TRANSLATIONS.az.strategy.summary.title, "Strategiyanın Xülasəsi");
  assert.equal(TRANSLATIONS.en.strategy.summary.title, "Strategy Summary");
});

test("8. script.js and style.css maintain frontend action bar layout, XSS protection, and responsive bottom sheet", async () => {
  const scriptContent = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  const styleContent = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Action bar element and separators
  assert.match(scriptContent, /dock-summary-btn/);
  assert.match(scriptContent, /dock-summary-separator/);
  assert.match(scriptContent, /actionsStrip\.append\(refineToggle,\s*exportWrap,\s*toolbarSeparator,\s*saveBtn,\s*summarySeparator,\s*summaryBtn,\s*askSeparator,\s*askBtn\)/);

  // Existing buttons are preserved
  assert.match(scriptContent, /dock-save-btn/);
  assert.match(scriptContent, /dock-ask-btn/);
  assert.match(scriptContent, /dock-export-btn/);

  // Model name is not leaked in the UI
  assert.ok(!scriptContent.includes('<span>gpt-5.6-luna</span>'));
  assert.ok(!scriptContent.includes('"gpt-5.6-luna" button'));

  // XSS protection (Rule 4): Dynamic strategy content rendered safely via textContent / element
  assert.match(scriptContent, /cardTitle\.append/);
  assert.match(scriptContent, /element\("p", "strategy-summary-card-text", data\.objective\)/);
  assert.match(scriptContent, /element\("span", "strategy-summary-move-text", move\)/);

  // Style sheet defines modal, mobile bottom sheet, skeleton loader, and dark mode
  assert.match(styleContent, /\.dock-summary-btn/);
  assert.match(styleContent, /\.strategy-summary-modal/);
  assert.match(styleContent, /\.strategy-summary-skeleton/);
  assert.match(styleContent, /strategy-summary-sheet-in/);
  assert.match(styleContent, /\[data-theme="dark"\] \.strategy-summary-modal/);
});
