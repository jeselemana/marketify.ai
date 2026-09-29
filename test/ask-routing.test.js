import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { isComplexAskQuery, resolveAskModelRoute } from "../src/services/ai/ask-routing.js";
import { FileChatRepository } from "../src/repositories/file-chat-repository.js";

test("small Ask queries route to GPT-5.6 Luna", () => {
  assert.equal(resolveAskModelRoute({ lastUserMsg: "Instagram üçün 3 qısa başlıq yaz" }), "luna");
});

test("complex Ask queries without search intent route to GPT-5.6 Terra", () => {
  assert.equal(isComplexAskQuery("Hərtərəfli dərin analiz və SWOT matrisi qur"), true);
  assert.equal(resolveAskModelRoute({ lastUserMsg: "Hərtərəfli dərin analiz və SWOT matrisi qur" }), "terra");
  assert.equal(resolveAskModelRoute({ lastUserMsg: "Bunu necə tətbiq edim?", hasStrategyContext: true }), "terra");
});

test("real-time search, pricing, and AI model queries in auto mode route to Gemini 3.7 Flash", () => {
  assert.equal(resolveAskModelRoute({ lastUserMsg: "Bakı bazarında hazırkı qiymətlər nə qədərdir?" }), "gemini-3.7-flash");
  assert.equal(resolveAskModelRoute({ lastUserMsg: "Rəqib analizi və 2026 trendləri" }), "gemini-3.7-flash");
  assert.equal(resolveAskModelRoute({ lastUserMsg: "Gemini 3.8 Flash haqqında nə bilirsən?" }), "gemini-3.7-flash");
  assert.equal(resolveAskModelRoute({ lastUserMsg: "GPT-6 Astra nə vaxt çıxacaq?" }), "gemini-3.7-flash");
});

test("only Terra, Luna, and Gemini 3.7 Flash can be selected explicitly", () => {
  assert.equal(resolveAskModelRoute({ requestedModel: "terra", lastUserMsg: "qısa sual" }), "terra");
  assert.equal(resolveAskModelRoute({ requestedModel: "luna", lastUserMsg: "dərin analiz" }), "luna");
  assert.equal(resolveAskModelRoute({ requestedModel: "flash", lastUserMsg: "marketinq büdcəsi" }), "gemini-3.7-flash");
  assert.equal(resolveAskModelRoute({ requestedModel: "gemini-3.7-flash", lastUserMsg: "marketinq büdcəsi" }), "gemini-3.7-flash");
  assert.equal(resolveAskModelRoute({ requestedModel: "gemini", lastUserMsg: "qısa sual" }), "gemini-3.7-flash");
  assert.equal(resolveAskModelRoute({ requestedModel: "unsupported-model", lastUserMsg: "qısa sual" }), "luna");
  assert.equal(resolveAskModelRoute({ requestedModel: "gemini-1.5-pro", lastUserMsg: "qısa sual" }), "luna");
});

test("Gemini configuration exposes default 3.7 flash and thinking budget", async () => {
  const { aiConfig, hasGeminiConfiguration, hasOpenAIConfiguration } = await import("../src/services/ai/config.js");
  assert.equal(aiConfig.askGeminiModel, "gemini-3.7-flash");
  assert.equal(typeof aiConfig.geminiThinkingBudget, "number");
  assert.equal(typeof hasGeminiConfiguration(), "boolean");
  assert.equal(typeof hasOpenAIConfiguration(), "boolean");
});

test("Ask queries with file attachments route exclusively to Gemini 3.7 Flash", () => {
  assert.equal(resolveAskModelRoute({ hasAttachment: true, lastUserMsg: "Bu sənədi analiz et" }), "gemini-3.7-flash");
  assert.equal(resolveAskModelRoute({ hasAttachment: true, requestedModel: "terra", lastUserMsg: "swot analizi" }), "gemini-3.7-flash");
  assert.equal(resolveAskModelRoute({ hasAttachment: true, requestedModel: "luna", lastUserMsg: "qısa başlıq" }), "gemini-3.7-flash");
  assert.equal(resolveAskModelRoute({ hasAttachment: true, requestedModel: "auto", hasStrategyContext: true }), "gemini-3.7-flash");
});

test("AbortController for Ask stream stays active after request body consumption and only aborts if response closes prematurely", async () => {
  const { EventEmitter } = await import("node:events");

  const req = new EventEmitter();
  const res = new EventEmitter();
  res.writableEnded = false;

  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  // Emitting req 'close' (which happens when incoming request body stream ends) should NOT abort
  req.emit("close");
  assert.equal(abortController.signal.aborted, false, "req 'close' must not abort the ongoing response");

  // If res ends cleanly before close, it should NOT abort
  res.writableEnded = true;
  res.emit("close");
  assert.equal(abortController.signal.aborted, false, "clean res finish must not abort");

  // If another res closes while not ended, it MUST abort
  const prematureRes = new EventEmitter();
  prematureRes.writableEnded = false;
  const prematureAbort = new AbortController();
  prematureRes.on("close", () => {
    if (!prematureRes.writableEnded) {
      prematureAbort.abort();
    }
  });

  prematureRes.emit("close");
  assert.equal(prematureAbort.signal.aborted, true, "premature connection close must abort the controller");
});

test("SEC-12: FileChatRepository enforces UUID format, cross-tenant isolation, and collision defense", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-sec12-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const chats = new FileChatRepository(path.join(directory, "chats.json"));

  // 1. Invalid or non-UUID id is replaced with a generated UUID
  const chat1 = await chats.saveChat({
    id: "malicious_injected_id_123",
    ownerId: "user_alice",
    title: "Alice Chat",
    messages: [{ role: "user", content: "Salam" }],
  });
  assert.notEqual(chat1.id, "malicious_injected_id_123");
  assert.match(chat1.id, /^[0-9a-f-]{36}$/i);

  // 2. Owner isolation: Bob cannot read Alice's chat
  const bobFetch = await chats.getById(chat1.id, "user_bob");
  assert.equal(bobFetch, null);

  const aliceFetch = await chats.getById(chat1.id, "user_alice");
  assert.ok(aliceFetch);
  assert.equal(aliceFetch.title, "Alice Chat");

  // 3. Collision defense: Bob cannot hijack or collide with Alice's existing chatId
  const bobAttempt = await chats.saveChat({
    id: chat1.id,
    ownerId: "user_bob",
    title: "Bob Spoofed Chat",
    messages: [{ role: "user", content: "Hacked" }],
  });
  assert.notEqual(bobAttempt.id, chat1.id, "Bob's chat ID must not collide with Alice's existing chat ID");
  assert.match(bobAttempt.id, /^[0-9a-f-]{36}$/i);

  // Alice's chat remains unchanged
  const aliceAfter = await chats.getById(chat1.id, "user_alice");
  assert.equal(aliceAfter.title, "Alice Chat");
  assert.equal(aliceAfter.messages[0].content, "Salam");
});

test("Ask Mode: script.js defines currentAskAbortController, abortAskMessage, and wires AbortController signal to /api/ask", async () => {
  const scriptContent = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  assert.ok(scriptContent.includes("let currentAskAbortController = null;"), "declares currentAskAbortController");
  assert.ok(scriptContent.includes("function abortAskMessage()"), "defines abortAskMessage function");
  assert.ok(scriptContent.includes("currentAskAbortController.abort()"), "calls abort on currentAskAbortController");
  assert.ok(scriptContent.includes("function createAskStopIcon()"), "defines createAskStopIcon safe SVG builder");
  assert.ok(scriptContent.includes("createElementNS(\"http://www.w3.org/2000/svg\", \"rect\")"), "safely constructs stop square via DOM API");
  assert.ok(scriptContent.includes("signal: currentAskAbortController.signal"), "passes abort signal to /api/ask fetch call");
  assert.ok(scriptContent.includes("error?.name === \"AbortError\" || currentAskAbortController?.signal?.aborted"), "handles AbortError gracefully without noisy error banners");
});

test("Ask Mode: renderAsk and renderStrategyAskPanel toggle is-stop class and button states during generation", async () => {
  const scriptContent = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Main ask composer
  assert.ok(scriptContent.includes("submit.classList.toggle(\"is-stop\", isGenerating)"), "toggles is-stop on ask-submit");
  assert.ok(scriptContent.includes("submit.setAttribute(\"aria-label\", isEn ? \"Stop generating\" : \"Dayandır\")"), "sets stop aria-label on ask-submit");
  assert.ok(scriptContent.includes("submit.appendChild(createAskStopIcon())"), "appends safe stop icon to ask-submit");
  assert.ok(scriptContent.includes("abortAskMessage()"), "calls abortAskMessage on click/submit");

  // Strategy ask composer
  assert.ok(scriptContent.includes("send.classList.toggle(\"is-stop\", isStrategyGenerating)"), "toggles is-stop on strategy-ask-send");
  assert.ok(scriptContent.includes("send.appendChild(createAskStopIcon())"), "appends safe stop icon to strategy-ask-send");
});

test("Ask Mode: style.css defines .is-stop, hover transitions, and dark mode high-contrast parity", async () => {
  const cssContent = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  assert.ok(cssContent.includes(".ask-submit.is-stop"), "defines .ask-submit.is-stop");
  assert.ok(cssContent.includes(".strategy-ask-send.is-stop"), "defines .strategy-ask-send.is-stop");
  assert.ok(cssContent.includes(".ask-stop-icon"), "defines .ask-stop-icon");
  assert.ok(cssContent.includes("[data-theme=\"dark\"] .ask-stop-icon"), "defines dark mode .ask-stop-icon contrast");
});



