import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import {
  createUserRouter,
  buildSystemPrompt,
  extractFirstName,
  AiSummaryRequestSchema,
  AiSummaryOutputSchema,
  checkAiSummaryRateLimit,
  aiSummaryRateMap,
  AI_SUMMARY_MAX_PER_WINDOW,
  AI_SUMMARY_WINDOW_MS,
} from "../src/http/user-router.js";
import { TRANSLATIONS } from "../public/i18n.js";
import { aiConfig } from "../src/services/ai/config.js";

test("aiConfig defines accountSummaryModel as gpt-5.6-luna", () => {
  assert.equal(aiConfig.accountSummaryModel, "gpt-5.6-luna");
});

test("extractFirstName extracts only first name and strips surname", () => {
  assert.equal(extractFirstName("Cesur Elemana"), "Cesur");
  assert.equal(extractFirstName("Cəsur Ələmanov"), "Cəsur");
  assert.equal(extractFirstName("Jese"), "Jese");
  assert.equal(extractFirstName(""), "");
});

test("AiSummaryRequestSchema enforces strict validation against unexpected fields (Rule 2)", () => {
  const validEmpty = AiSummaryRequestSchema.safeParse({});
  assert.ok(validEmpty.success);

  const validRefresh = AiSummaryRequestSchema.safeParse({ forceRefresh: true });
  assert.ok(validRefresh.success);
  assert.equal(validRefresh.data.forceRefresh, true);

  const invalidField = AiSummaryRequestSchema.safeParse({ forceRefresh: true, injectedField: "malicious" });
  assert.ok(!invalidField.success, "Strict validation must reject unwhitelisted fields");
});

test("AiSummaryOutputSchema validates summary length and focus tags count", () => {
  const valid = AiSummaryOutputSchema.safeParse({
    summary: "Cəsur, marketinq strategiyanız sürətlə inkişaf edir. Əsas fokus yüksək dönüşümlü kanallara yönəldilməlidir.",
    focusTags: ["B2B SaaS", "Dönüşüm Optimizasiyası", "AI Marketing"],
  });
  assert.ok(valid.success);

  const tooShort = AiSummaryOutputSchema.safeParse({
    summary: "Hi",
    focusTags: ["Tag1"],
  });
  assert.ok(!tooShort.success);

  const emptyTags = AiSummaryOutputSchema.safeParse({
    summary: "Valid length summary for testing purposes.",
    focusTags: [],
  });
  assert.ok(!emptyTags.success);
});

test("buildSystemPrompt addresses by first name only, incorporates playful teasing, and includes tenant activity", () => {
  const promptAz = buildSystemPrompt({
    displayName: "Cəsur Ələmanov",
    language: "az",
    settings: {
      brandName: "Helmer",
      industry: "B2B Marketing SaaS",
      primaryMarket: "Baku & Global",
      targetAudience: "Tech Founders",
      tone: "creative",
      customInstructions: "Xüsusi təlimat: hər zaman konkret nəticələr vurğulansın.",
      memories: [{ text: "Əsas məqsəd Q3 lead artımıdır." }],
    },
    strategies: [{ title: "Bakı Coffee Shop Bazara Giriş" }],
    chats: [{ title: "Qıfın optimizasiyası" }],
    tasks: [{ title: "Landing page hazırlığı" }],
  });

  // Must address by first name only and explicitly forbid surname
  assert.match(promptAz, /Cəsur/);
  assert.ok(!promptAz.includes("Ələmanov"), "Surname must be excluded from prompt address");
  assert.match(promptAz, /Helmer/);
  assert.match(promptAz, /YALNIZ AD İLƏ BİRBAŞA MÜRACİƏT/);
  assert.match(promptAz, /sataş/i);
  assert.match(promptAz, /Bakı Coffee Shop Bazara Giriş/);
  assert.match(promptAz, /Qıfın optimizasiyası/);
  assert.match(promptAz, /Landing page hazırlığı/);

  const promptEn = buildSystemPrompt({
    displayName: "Jese Eleman",
    language: "en",
    settings: {
      brandName: "Helmer",
      tone: "professional",
    },
    strategies: [{ title: "SaaS Expansion" }],
  });

  assert.match(promptEn, /Jese/);
  assert.ok(!promptEn.includes("Eleman"), "Surname must be excluded from prompt address");
  assert.match(promptEn, /ADDRESS BY FIRST NAME ONLY/);
  assert.match(promptEn, /PLAYFUL TEASING/);
  assert.match(promptEn, /SaaS Expansion/);
});

function invokeRoute(router, req) {
  return new Promise((resolve) => {
    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: statusCode, body: data });
      },
      set() {
        return this;
      },
    };
    const expressReq = {
      method: req.method || "POST",
      url: req.url || "/ai-summary",
      body: req.body || {},
      user: req.user || null,
      ip: req.ip || "127.0.0.1",
      socket: { remoteAddress: req.ip || "127.0.0.1" },
    };
    router(expressReq, res, (err) => {
      if (err) resolve({ status: 500, error: err });
      else resolve({ status: 404 });
    });
  });
}

test("POST /api/user/ai-summary requires authentication (401)", async () => {
  const router = createUserRouter({
    userRepository: {},
    strategyRepository: {},
    chatRepository: {},
    plannerRepository: {},
  });

  const response = await invokeRoute(router, {
    method: "POST",
    url: "/ai-summary",
    user: null,
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "AUTH_REQUIRED");
});

test("POST /api/user/ai-summary requires Personalization to be enabled (403)", async () => {
  const router = createUserRouter({
    userRepository: {},
    strategyRepository: {},
    chatRepository: {},
    plannerRepository: {},
  });

  const response = await invokeRoute(router, {
    method: "POST",
    url: "/ai-summary",
    user: {
      id: "usr_12345",
      fullName: "Test User",
      settings: { personalIntelligence: false },
    },
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "PERSONALIZATION_DISABLED");
});

test("POST /api/user/ai-summary returns cached summary without model request when forceRefresh is false", async () => {
  const existingSummary = {
    summary: "Cəsur, cari marketinq aktivlikləriniz yüksək templə irəliləyir.",
    focusTags: ["B2B SaaS", "Böyümə"],
    model: "gpt-5.6-luna",
    generatedAt: "2026-09-07T12:00:00.000Z",
  };

  const router = createUserRouter({
    userRepository: {},
    strategyRepository: {},
    chatRepository: {},
    plannerRepository: {},
  });

  const response = await invokeRoute(router, {
    method: "POST",
    url: "/ai-summary",
    body: { forceRefresh: false },
    user: {
      id: "usr_cached",
      fullName: "Cəsur",
      settings: { personalIntelligence: true },
      aiSummary: existingSummary,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.cached, true);
  assert.equal(response.body.summary, existingSummary.summary);
  assert.deepEqual(response.body.focusTags, existingSummary.focusTags);
  assert.equal(response.body.model, "gpt-5.6-luna");
});

test("POST /api/user/ai-summary generates new summary and persists to user repository", async () => {
  let updatedUserId = null;
  let updatedPayload = null;

  const userRepository = {
    async update(id, payload) {
      updatedUserId = id;
      updatedPayload = payload;
      return { id, ...payload };
    },
  };

  const mockOpenAiClient = {
    chat: {
      completions: {
        async create({ messages }) {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "Cesur, hər şeyi eyni anda fəth etməyə çalışırsan, amma artıq birbaşa icraya və satışa keçmək vaxtıdır.",
                    focusTags: ["İcraya keç", "Böyümə"],
                  }),
                },
              },
            ],
          };
        },
      },
    },
  };

  const router = createUserRouter({
    userRepository,
    openAiClient: mockOpenAiClient,
    strategyRepository: {
      async readAll() {
        return [{ ownerId: "usr_gen", title: "Restoran və E-commerce" }];
      },
    },
    chatRepository: {
      async readAll() {
        return [];
      },
    },
    plannerRepository: {
      async list() {
        return [];
      },
    },
  });

  const response = await invokeRoute(router, {
    method: "POST",
    url: "/ai-summary",
    body: { forceRefresh: true },
    user: {
      id: "usr_gen",
      fullName: "Cesur Elemana",
      settings: { personalIntelligence: true },
      aiSummary: null,
    },
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.summary.startsWith("Cesur,"), "Summary must start with first name 'Cesur,'");
  assert.ok(!response.body.summary.includes("Elemana"), "Summary must not contain surname");
  assert.ok(Array.isArray(response.body.focusTags));
  assert.equal(updatedUserId, "usr_gen");
  assert.ok(updatedPayload?.aiSummary);
});

test("checkAiSummaryRateLimit limits regeneration to 3 requests per hour (Rule 6)", () => {
  aiSummaryRateMap.clear();
  assert.equal(AI_SUMMARY_MAX_PER_WINDOW, 3);
  assert.equal(AI_SUMMARY_WINDOW_MS, 60 * 60 * 1000);

  const testKey = "rate-limit-test-user";
  const r1 = checkAiSummaryRateLimit(testKey);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  const r2 = checkAiSummaryRateLimit(testKey);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  const r3 = checkAiSummaryRateLimit(testKey);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  // 4th call must be rejected
  const r4 = checkAiSummaryRateLimit(testKey);
  assert.equal(r4.allowed, false);
  assert.equal(r4.remaining, 0);
  assert.ok(r4.resetAt > Date.now());
});

test("POST /api/user/ai-summary returns 429 when hourly regeneration limit is exceeded", async () => {
  aiSummaryRateMap.clear();
  const userId = "usr_ratelimited";
  const clientIp = "127.0.0.1";
  const rateLimitKey = `${clientIp}:${userId}`;

  // Fill up the 3 allowed slots
  checkAiSummaryRateLimit(rateLimitKey);
  checkAiSummaryRateLimit(rateLimitKey);
  checkAiSummaryRateLimit(rateLimitKey);

  const router = createUserRouter({
    userRepository: {},
    strategyRepository: {},
    chatRepository: {},
    plannerRepository: {},
  });

  const response = await invokeRoute(router, {
    method: "POST",
    url: "/ai-summary",
    body: { forceRefresh: true },
    user: {
      id: userId,
      fullName: "Cesur",
      settings: { personalIntelligence: true },
    },
  });

  assert.equal(response.status, 429);
  assert.equal(response.body.code, "RATE_LIMITED");
  assert.ok(response.body.error.includes("3"));
});

test("i18n: translations include complete aiSummary keys in both AZ and EN", () => {
  const azSummary = TRANSLATIONS.az.settings.aiSummary;
  const enSummary = TRANSLATIONS.en.settings.aiSummary;

  assert.ok(azSummary, "AZ settings.aiSummary exists");
  assert.ok(enSummary, "EN settings.aiSummary exists");

  assert.equal(azSummary.title, "Hesab Xülasəsi");
  assert.equal(enSummary.title, "Account Summary");
  assert.equal(azSummary.badge, "");
  assert.equal(enSummary.badge, "");

  assert.ok(azSummary.disabledNotice.includes("Personalization"));
  assert.ok(enSummary.disabledNotice.includes("Personalization"));

  const requiredKeys = [
    "title",
    "badge",
    "disabledNotice",
    "enableBtn",
    "regenerateBtn",
    "regenerating",
    "loading",
    "error",
    "retryBtn",
    "poweredBy",
    "focusTagsLabel",
  ];

  for (const key of requiredKeys) {
    assert.ok(azSummary[key] !== undefined, `AZ aiSummary.${key} must be defined`);
    assert.ok(enSummary[key] !== undefined, `EN aiSummary.${key} must be defined`);
  }
});

test("Frontend script.js: AI summary card complies with XSS protection, personalization gate, and is placed above profileCard", async () => {
  const script = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Mount point in Account tab: summary card is placed ABOVE profileCard
  assert.ok(script.includes("buildAiAccountSummaryCard()"), "buildAiAccountSummaryCard is called in Account tab");
  assert.ok(script.includes("panel.appendChild(buildAiAccountSummaryCard())"), "card is appended to Account panel");

  const profileCardIndex = script.indexOf("panel.appendChild(profileCard);");
  const summaryCardIndex = script.indexOf("panel.appendChild(buildAiAccountSummaryCard());");
  assert.ok(profileCardIndex > 0, "profileCard is appended to panel");
  assert.ok(summaryCardIndex > 0, "summary card is appended to panel");
  assert.ok(summaryCardIndex < profileCardIndex, "summary card must be appended above profileCard");

  // Personalization gate check
  assert.ok(script.includes("personalIntelligence === true"), "Checks if personalIntelligence is enabled");
  assert.ok(script.includes("is-disabled-state"), "Applies is-disabled-state when disabled");
  assert.ok(script.includes("settingsTab = \"experience\""), "Allows navigating to experience (Personalization) tab to enable");

  // Header and controls
  assert.ok(script.includes("ai-summary-card-title"), "Renders card title");
  assert.ok(script.includes("ai-summary-sparkle-icon"), "Renders sparkle icon");
  assert.ok(script.includes("ai-summary-refresh-btn"), "Renders regenerate button");
  assert.ok(script.includes("ai-summary-skeleton"), "Renders skeleton loader");

  // Rule 4 (Frontend XSS Protection): summary and tags must be rendered securely via textContent
  assert.ok(script.includes("summaryP.textContent = data.summary;"), "Summary text is assigned via textContent (XSS protection)");
  assert.ok(script.includes("tagPill.textContent = tag;"), "Tag pills are assigned via textContent (XSS protection)");
});

test("Frontend style.css: AI summary card includes light and dark mode rules (Slate 950/900/800)", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Light mode styles
  assert.ok(css.includes(".ai-account-summary-card {"), "Base card container is defined");
  assert.ok(css.includes(".ai-summary-model-badge {"), "Badge style is defined");
  assert.ok(css.includes(".ai-summary-skeleton {"), "Skeleton loader is defined");
  assert.ok(css.includes("@keyframes aiSummaryShimmer"), "Shimmer animation is defined");
  assert.ok(css.includes("@keyframes aiSummarySpin"), "Spin animation is defined");

  // Dark mode overrides
  assert.ok(css.includes('[data-theme="dark"] .ai-account-summary-card'), "Dark mode card style is defined");
  assert.ok(css.includes("html.dark .ai-account-summary-card"), "html.dark card style is defined");
  assert.ok(css.includes('[data-theme="dark"] .ai-summary-model-badge'), "Dark mode badge style is defined");
  assert.ok(css.includes('[data-theme="dark"] .ai-summary-refresh-btn'), "Dark mode refresh button is defined");
  assert.ok(css.includes('[data-theme="dark"] .ai-summary-content'), "Dark mode summary content is defined");
});

test("GET /api/user/ai-summary returns 404 when no summary exists and 200 when summary exists", async () => {
  const router = createUserRouter({
    userRepository: {},
    strategyRepository: {},
    chatRepository: {},
    plannerRepository: {},
  });

  const notFoundRes = await invokeRoute(router, {
    method: "GET",
    url: "/ai-summary",
    user: {
      id: "usr_nosummary",
      fullName: "Test User",
      settings: { personalIntelligence: true },
    },
  });
  assert.equal(notFoundRes.status, 404);
  assert.equal(notFoundRes.body.code, "NO_SUMMARY_FOUND");

  const foundRes = await invokeRoute(router, {
    method: "GET",
    url: "/ai-summary",
    user: {
      id: "usr_withsummary",
      fullName: "Test User",
      settings: { personalIntelligence: true },
      aiSummary: {
        summary: "Test summary",
        focusTags: ["Tag A"],
        model: "gpt-5.6-luna",
        generatedAt: "2026-09-07T12:00:00.000Z",
      },
    },
  });
  assert.equal(foundRes.status, 200);
  assert.equal(foundRes.body.summary, "Test summary");
});

test("auth-router publicUser includes aiSummary field", async () => {
  const { publicUser } = await import("../src/http/auth-router.js");
  const user = {
    id: "usr_test",
    fullName: "Jese Eleman",
    username: "jese",
    email: "jese@example.com",
    aiSummary: {
      summary: "Jese, execution is on track.",
      focusTags: ["Growth", "B2B"],
      model: "gpt-5.6-luna",
    },
    settings: {
      personalIntelligence: true,
    },
  };
  const pub = publicUser(user);
  assert.ok(pub.aiSummary, "aiSummary must be included in publicUser output");
  assert.equal(pub.aiSummary.summary, "Jese, execution is on track.");
  assert.deepEqual(pub.aiSummary.focusTags, ["Growth", "B2B"]);
});

