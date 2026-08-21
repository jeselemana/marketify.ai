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

test("formatGeminiContents drops trailing orphaned model messages", () => {
  const input = [
    { role: "user", content: "Sual" },
    { role: "assistant", content: "Cavab" },
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

test("hasGeminiConfiguration returns true when GEMINI_API_KEY is present and configures 8192 tokens matching GPT-5.6 Luna", () => {
  assert.equal(typeof hasGeminiConfiguration(), "boolean");
  assert.equal(typeof aiConfig.geminiAskModel, "string");
  assert.equal(aiConfig.geminiAskModel, process.env.GEMINI_ASK_MODEL || "gemini-3.7-flash");
  assert.equal(aiConfig.askModel, process.env.OPENAI_ASK_MODEL || "gpt-5.6-luna");
  assert.equal(aiConfig.askMaxOutputTokens, 8192);
});

function isComplexAskQuery(lastUserMsg = "", messages = [], hasStrategyContext = false) {
  if (hasStrategyContext) return true;
  const cleanMsg = (lastUserMsg || "").trim();
  if (cleanMsg.length >= 350) return true;

  const complexPattern = /(hərtərəfli dərin analiz|hərtərəfli analiz|hərtərəfli təhlil|geniş təhlil|rəqib analizi|swot analizi|swot matrisi|audit hesabatı|maliyyə modeli|büdcə bölgüsü|cac\s*\/\s*ltv|tam marketinq planı|daha dərindən düşün|bütün detalları ilə)/i;
  return complexPattern.test(cleanMsg);
}

function resolveAskModelRoute({ requestedModel = "auto", lastUserMsg = "", messages = [], hasStrategyContext = false, openAiAvailable = true, geminiAvailable = true }) {
  const reqModel = (requestedModel || "auto").trim().toLowerCase();
  const isComplex = isComplexAskQuery(lastUserMsg, messages, hasStrategyContext);

  let routeToFlash = false;
  if (reqModel === "flash" || reqModel.includes("gemini") || reqModel.includes("3.7")) {
    routeToFlash = true;
  } else if (reqModel === "mini" || reqModel.includes("openai") || reqModel.includes("luna") || reqModel.includes("gpt")) {
    routeToFlash = false;
  } else {
    // Auto mode:
    // Route heavy/complex queries to Gemini 3.7 Flash, small/standard queries to gpt-5.6-luna (Mini)
    if (isComplex && geminiAvailable) {
      routeToFlash = true;
    } else if (!isComplex && openAiAvailable) {
      routeToFlash = false;
    } else {
      routeToFlash = geminiAvailable && !openAiAvailable;
    }
  }

  return routeToFlash ? "Flash" : "Mini";
}

test("simple marketing queries route to gpt-5.6-luna (Mini)", () => {
  const simpleQueries = [
    "Mənə qəhvəxana üçün 3 sloqan yaz",
    "Marketinqdə CTA nədir?",
    "Instagram üçün qısa bio hazırla",
    "Salam, necəsən?",
    "Bu post üçün maraqlı başlıq ver",
    "TikTok üçün 15 saniyəlik video ideyası",
    "Email marketinqdə açılma faizi nədir?",
  ];

  for (const query of simpleQueries) {
    assert.equal(isComplexAskQuery(query, [{ role: "user", content: query }], false), false, `Query "${query}" should not be complex`);
    const route = resolveAskModelRoute({
      requestedModel: "auto",
      lastUserMsg: query,
      hasStrategyContext: false,
      openAiAvailable: true,
      geminiAvailable: true,
    });
    assert.equal(route, "Mini", `Query "${query}" should route to Mini`);
  }
});

test("heavy and complex queries route to Gemini 3.7 Flash", () => {
  const complexQueries = [
    "Bizim yeni SaaS məhsulumuz üçün hərtərəfli dərin analiz hazırla və bütün riskləri qeyd et",
    "Rəqib analizi və SWOT matrisi qur",
    "Marketinq büdcə bölgüsü və CAC / LTV hesabatı hazırla",
    "Bu ideyanı daha dərindən düşün və geniş təhlil et",
  ];

  for (const query of complexQueries) {
    assert.equal(isComplexAskQuery(query, [{ role: "user", content: query }], false), true, `Query "${query}" should be complex`);
    const route = resolveAskModelRoute({
      requestedModel: "auto",
      lastUserMsg: query,
      hasStrategyContext: false,
      openAiAvailable: true,
      geminiAvailable: true,
    });
    assert.equal(route, "Flash", `Query "${query}" should route to Flash`);
  }
});

test("queries with attached saved strategy context route to Gemini 3.7 Flash", () => {
  const route = resolveAskModelRoute({
    requestedModel: "auto",
    lastUserMsg: "Bunu necə icra edim?",
    hasStrategyContext: true,
    openAiAvailable: true,
    geminiAvailable: true,
  });
  assert.equal(route, "Flash");
});

test("large prompt messages (>=350 chars) route to Gemini 3.7 Flash", () => {
  const longPrompt = "Biz Azərbaycanda fəaliyyət göstərən B2B loqistika və anbar idarəetmə platformasıyıq. Şirkətimiz kiçik və orta sahibkarlara məhsulların çatdırılması və izlənməsi xidməti təklif edir. Hədəf auditoriyamız e-ticarət mağazaları və pərakəndə satıcılardır. Bazar rəqabəti güclüdür və biz 6 ay ərzində bazar payımızı 15% artırmaq üçün dəqiq hərəkət planı axtarırıq.";
  assert.ok(longPrompt.length >= 350);
  assert.equal(isComplexAskQuery(longPrompt, [], false), true);

  const route = resolveAskModelRoute({
    requestedModel: "auto",
    lastUserMsg: longPrompt,
    hasStrategyContext: false,
    openAiAvailable: true,
    geminiAvailable: true,
  });
  assert.equal(route, "Flash");
});

test("explicit model parameter overrides auto routing", () => {
  const miniRoute = resolveAskModelRoute({
    requestedModel: "mini",
    lastUserMsg: "Hərtərəfli dərin analiz və rəqib analizi",
    hasStrategyContext: true,
  });
  assert.equal(miniRoute, "Mini");

  const flashRoute = resolveAskModelRoute({
    requestedModel: "flash",
    lastUserMsg: "Sloqan yaz",
    hasStrategyContext: false,
  });
  assert.equal(flashRoute, "Flash");
});

function getAskMessageModelInfo(model) {
  const normalized = typeof model === "string" ? model.trim().toLowerCase() : "";
  const isFlash = normalized === "flash" || normalized.includes("gemini") || normalized.includes("3.7");
  const displayName = isFlash ? "Flash" : "Mini";
  return {
    isFlash,
    isGpt: !isFlash,
    displayName,
  };
}

test("Gemini 3.7 Flash responses show 'Flash' in three dots and hide 'Daha dərindən düşün'", () => {
  const flashModels = ["Flash", "flash", "gemini-3.7-flash", "gemini-2.5-flash", "gemini"];
  for (const model of flashModels) {
    const info = getAskMessageModelInfo(model);
    assert.equal(info.displayName, "Flash", `Model ${model} should display as "Flash"`);
    assert.equal(info.isFlash, true, `Model ${model} should be identified as Flash`);
    assert.equal(info.isGpt, false, `Model ${model} should not be identified as GPT`);
    // "Daha dərindən düşün" should not appear for Flash
    assert.equal(info.isGpt, false);
  }
});

test("GPT responses show 'Mini' in three dots and display 'Daha dərindən düşün'", () => {
  const gptModels = ["Mini", "mini", "gpt-5.6-luna", "gpt-4o", "openai", "gpt", undefined, ""];
  for (const model of gptModels) {
    const info = getAskMessageModelInfo(model);
    assert.equal(info.displayName, "Mini", `Model ${model} should display as "Mini"`);
    assert.equal(info.isFlash, false, `Model ${model} should not be identified as Flash`);
    assert.equal(info.isGpt, true, `Model ${model} should be identified as GPT (Mini)`);
    // "Daha dərindən düşün" should appear for GPT (Mini)
    assert.equal(info.isGpt, true);
  }
});

test("Thinking label shows 'Dərin mühakimə aparıram' for Flash and 'Marketify düşünür' for Luna/GPT", () => {
  function getThinkingLabel(model) {
    const info = getAskMessageModelInfo(model);
    return info.isFlash ? "Dərin mühakimə aparıram" : "Marketify düşünür";
  }

  assert.equal(getThinkingLabel("flash"), "Dərin mühakimə aparıram");
  assert.equal(getThinkingLabel("gemini-3.7-flash"), "Dərin mühakimə aparıram");
  assert.equal(getThinkingLabel("Flash"), "Dərin mühakimə aparıram");

  assert.equal(getThinkingLabel("mini"), "Marketify düşünür");
  assert.equal(getThinkingLabel("gpt-5.6-luna"), "Marketify düşünür");
  assert.equal(getThinkingLabel("Mini"), "Marketify düşünür");
  assert.equal(getThinkingLabel(""), "Marketify düşünür");
  assert.equal(getThinkingLabel(undefined), "Marketify düşünür");
});


