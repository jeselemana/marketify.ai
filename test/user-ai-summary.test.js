import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import {
  createUserRouter,
  buildSystemPrompt,
  AiSummaryRequestSchema,
  AiSummaryOutputSchema,
} from "../src/http/user-router.js";
import { TRANSLATIONS } from "../public/i18n.js";
import { aiConfig } from "../src/services/ai/config.js";

test("aiConfig defines accountSummaryModel as gpt-5.6-luna", () => {
  assert.equal(aiConfig.accountSummaryModel, "gpt-5.6-luna");
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

test("buildSystemPrompt incorporates user name, direct address rule, bold tone, and tenant activity context", () => {
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

  assert.match(promptAz, /Cəsur Ələmanov/);
  assert.match(promptAz, /Helmer/);
  assert.match(promptAz, /BİRBAŞA MÜRACİƏT/);
  assert.match(promptAz, /Cəsarətli, iddialı, dinamik/);
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

  assert.match(promptEn, /Jese Eleman/);
  assert.match(promptEn, /ADDRESS BY NAME/);
  assert.match(promptEn, /Bold, ambitious, dynamic/);
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

test("Frontend script.js: AI summary card complies with XSS protection and personalization gate", async () => {
  const script = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Mount point in Account tab
  assert.ok(script.includes("buildAiAccountSummaryCard()"), "buildAiAccountSummaryCard is called in Account tab");
  assert.ok(script.includes("panel.appendChild(buildAiAccountSummaryCard())"), "card is appended to Account panel");

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

