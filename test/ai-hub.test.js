import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { t, TRANSLATIONS } from "../public/i18n.js";

test("index.html: AI Hub exists in sidebar primary navigation and navigation rail with Tezliklə badge", async () => {
  const html = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");

  // Sidebar navigation item
  assert.ok(html.includes('id="aiHubNav"'), "aiHubNav button element exists in primary navigation");
  assert.ok(html.includes('class="ai-hub-label">AI Hub<'), "ai-hub-label exists with default AI Hub text");
  assert.ok(html.includes('class="ai-hub-badge">Tezliklə<'), "ai-hub-badge exists with default 'Tezliklə' badge");

  // Rail navigation item
  assert.ok(html.includes('id="railAiHubButton"'), "railAiHubButton exists in navigation rail");
  assert.ok(html.includes('data-tooltip="AI Hub (Tezliklə)"'), "railAiHubButton has tooltip with Tezliklə indicator");

  // Ordering in sidebar: upNav -> aiHubNav -> limitsNav
  const upNavIndex = html.indexOf('id="upNav"');
  const aiHubNavIndex = html.indexOf('id="aiHubNav"');
  const limitsNavIndex = html.indexOf('id="limitsNav"');
  assert.ok(upNavIndex !== -1 && aiHubNavIndex !== -1 && limitsNavIndex !== -1, "All nav items exist");
  assert.ok(upNavIndex < aiHubNavIndex, "upNav precedes aiHubNav");
  assert.ok(aiHubNavIndex < limitsNavIndex, "aiHubNav precedes limitsNav");
});

test("i18n.js: aiHub translations exist with 100% key parity in AZ and EN, anchored on core thesis", () => {
  // Navigation key parity
  assert.equal(t("nav.aiHub", {}, "az"), "AI Hub");
  assert.equal(t("nav.aiHub", {}, "en"), "AI Hub");
  assert.equal(t("nav.comingSoon", {}, "az"), "Tezliklə");
  assert.equal(t("nav.comingSoon", {}, "en"), "Coming soon");

  // Section parity
  const azHub = TRANSLATIONS.az.aiHub;
  const enHub = TRANSLATIONS.en.aiHub;
  assert.ok(azHub, "az aiHub dictionary exists");
  assert.ok(enHub, "en aiHub dictionary exists");

  assert.equal(azHub.title, "Helmer SI Hub");
  assert.equal(enHub.title, "Helmer SI Hub");

  // Kicker only contains Tezliklə / Coming soon
  assert.equal(azHub.kicker, "Tezliklə");
  assert.equal(enHub.kicker, "Coming soon");

  // Model selector specifies Gemini 4 Argon
  assert.equal(azHub.modelName, "Gemini 4 Argon");
  assert.equal(enHub.modelName, "Gemini 4 Argon");

  // Chip labels (No raw emojis; chip 3 uses Müxtəlif modellər / Diverse Models)
  assert.equal(azHub.chipModels, "Müxtəlif modellər");
  assert.equal(azHub.chipGoogle, "Müxtəlif modellər");
  assert.equal(enHub.chipModels, "Diverse Models");
  assert.equal(enHub.chipGoogle, "Diverse Models");
  assert.equal(enHub.chipLimits, "Higher Limits");

  assert.ok(!azHub.chipLimits.includes("⚡"), "AZ chipLimits has no emojis");
  assert.ok(!azHub.chipPlayground.includes("🧪"), "AZ chipPlayground has no emojis");
  assert.ok(!azHub.chipModels.includes("🌐"), "AZ chipModels has no emojis");

  assert.ok(!enHub.chipLimits.includes("⚡"), "EN chipLimits has no emojis");
  assert.ok(!enHub.chipPlayground.includes("🧪"), "EN chipPlayground has no emojis");
  assert.ok(!enHub.chipModels.includes("🌐"), "EN chipModels has no emojis");

  // Core thesis checks (Playground, diverse models, initially Google models, high/higher limits)
  assert.ok(azHub.lead.includes("playground"), "AZ lead mentions playground");
  assert.ok(azHub.subtext.includes("Google modellərinə"), "AZ subtext mentions Google models initially");
  assert.ok(azHub.subtext.includes("yüksək limitlərlə"), "AZ subtext mentions high limits");
  assert.ok(azHub.subtext.includes("müxtəlif modellərə"), "AZ subtext mentions diverse models");

  assert.ok(enHub.lead.includes("playground"), "EN lead mentions playground");
  assert.ok(enHub.subtext.includes("Google's cutting-edge models"), "EN subtext mentions Google models");
  assert.ok(enHub.subtext.includes("higher limits"), "EN subtext mentions higher limits");

  // Tagline under subtext
  assert.equal(azHub.tagline, "Fərqli istifadə sahəsi. Eyni rəvan Helmer təcrübəsi.");
  assert.equal(enHub.tagline, "Different use case. Same seamless Helmer experience.");

  // Feature cards verification
  assert.ok(azHub.cardPlaygroundTitle && azHub.cardPlaygroundDesc);
  assert.ok(azHub.cardModelsTitle && azHub.cardModelsDesc);
  assert.ok(azHub.cardGoogleTitle && azHub.cardGoogleDesc);
  assert.ok(azHub.cardLimitsTitle && azHub.cardLimitsDesc);

  assert.ok(enHub.cardPlaygroundTitle && enHub.cardPlaygroundDesc);
  assert.ok(enHub.cardModelsTitle && enHub.cardModelsDesc);
  assert.ok(enHub.cardGoogleTitle && enHub.cardGoogleDesc);
  assert.ok(enHub.cardLimitsTitle && enHub.cardLimitsDesc);

  // FAQ parity and user-specified Q&A assertions
  assert.equal(azHub.faqTitle, "Tez-tez verilən suallar");
  assert.equal(enHub.faqTitle, "Frequently Asked Questions");
  assert.equal(azHub.faqBadge, "6 sual");
  assert.equal(enHub.faqBadge, "6 questions");

  // User question 1 (Limit)
  assert.equal(azHub.faqQ1, "Limit tətbiq ediləcək?");
  assert.equal(
    azHub.faqA1,
    "Dürüst olaq: bəli, çünki bu (xüsusilə flaqman modellər) ciddi xərc tələb edir, lakin ilkin mərhələdə ciddi şəkildə aşağı olacaq, sonradan isə balansı daim qoruyacağıq."
  );

  // User question 2 (Multimodal models)
  assert.equal(azHub.faqQ2, "Multimodal modellər əlçatan olacaq?");
  assert.equal(
    azHub.faqA2,
    "Bəli, olacaq, amma ilkin mərhələdə yalnız mətn əsaslı modellərin inteqrasiyası nəzərdə tutulub."
  );

  // General questions 3, 4, 5
  assert.ok(azHub.faqQ3 && azHub.faqA3, "AZ FAQ Q3/A3 defined");
  assert.ok(azHub.faqQ4 && azHub.faqA4, "AZ FAQ Q4/A4 defined");
  assert.ok(azHub.faqQ5 && azHub.faqA5, "AZ FAQ Q5/A5 defined");

  // User question 6 (Why SI, not AI?)
  assert.equal(azHub.faqQ6, "Niyə AI yox, SI?");
  assert.equal(azHub.faqA6, "Çünki mükəmməl olmaq uğrunda buradayıq! Elə bilmə ki, manifestdi 😉");
  assert.equal(azHub.faqLink6, undefined, "AZ faqLink6 removed");

  assert.ok(enHub.faqQ1 && enHub.faqA1, "EN FAQ Q1/A1 defined");
  assert.ok(enHub.faqQ2 && enHub.faqA2, "EN FAQ Q2/A2 defined");
  assert.ok(enHub.faqQ3 && enHub.faqA3, "EN FAQ Q3/A3 defined");
  assert.ok(enHub.faqQ4 && enHub.faqA4, "EN FAQ Q4/A4 defined");
  assert.ok(enHub.faqQ5 && enHub.faqA5, "EN FAQ Q5/A5 defined");
  assert.equal(enHub.faqQ6, "Why SI instead of AI?");
  assert.equal(enHub.faqA6, "Because we are here in pursuit of excellence! Don't think it's a manifesto 😉");
  assert.equal(enHub.faqLink6, undefined, "EN faqLink6 removed");
});

test("script.js: implements renderAiHubView with inactive input bar, smooth animation hooks, and click listeners", async () => {
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Selector definitions
  assert.ok(js.includes('const aiHubNav = document.querySelector("#aiHubNav");'), "aiHubNav selector defined");
  assert.ok(js.includes('const railAiHubButton = document.querySelector("#railAiHubButton");'), "railAiHubButton selector defined");

  // Inclusion in nonHomeViews and syncNav
  assert.ok(js.includes('"aiHub"'), "aiHub view included in script");
  assert.ok(
    js.includes('for (const id of ["aiHubNav", "railAiHubButton"]) document.getElementById(id)?.classList.toggle("is-active", state.view === "aiHub");'),
    "is-active class toggling registered for aiHubNav"
  );

  // Routing in render()
  assert.ok(js.includes('if (state.view === "aiHub") return renderAiHubView();'), "render() routes to renderAiHubView");

  // renderAiHubView function presence and safe input bar construction
  assert.ok(js.includes("function renderAiHubView()"), "renderAiHubView function is defined");
  assert.ok(js.includes('workspace.classList.add("workspace-ai-hub");'), "workspace-ai-hub class added to workspace");
  assert.ok(js.includes("Gemini 4 Argon"), "model name defaults to Gemini 4 Argon");
  assert.ok(js.includes("ai-hub-chip-icon"), "chips use dedicated SVG icon containers");
  assert.ok(js.includes('aiHub.chipModels'), "chips use chipModels translation key");
  assert.ok(js.includes('textarea.disabled = true;'), "Input bar textarea is strictly disabled");
  assert.ok(js.includes('textarea.readOnly = true;'), "Input bar textarea is marked readOnly");
  assert.ok(js.includes('sendBtn.disabled = true;'), "Input bar send button is disabled");

  // Tagline under subtext
  assert.ok(js.includes("ai-hub-tagline"), "ai-hub-tagline element created");
  assert.ok(js.includes("aiHub.tagline"), "Tagline uses aiHub.tagline translation");

  // Collapsed FAQ card in script.js
  assert.ok(js.includes('faqCard.className = "ai-hub-faq-card"'), "FAQ card created");
  assert.ok(js.includes('ai-hub-faq-summary'), "FAQ summary element created");
  assert.ok(js.includes('ai-hub-faq-body'), "FAQ body element created");
  assert.ok(js.includes('ai-hub-faq-item'), "FAQ item element created");
  assert.ok(js.includes('ai-hub-faq-link'), "Clickable link element exists in FAQ");
  assert.ok(js.includes('ai-hub-faq-item-note'), "Note element exists in FAQ");

  // Click listeners registered
  assert.ok(
    js.includes('for (const id of ["aiHubNav", "railAiHubButton"]) document.getElementById(id)?.addEventListener("click",'),
    "Click listeners registered for aiHub buttons"
  );
});

test("style.css: includes premium animation, inactive input bar styling, dark mode rules, and mobile ergonomics", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Badge styling
  assert.ok(css.includes(".ai-hub-badge"), ".ai-hub-badge class defined");
  assert.ok(css.includes('[data-theme="dark"] .ai-hub-badge'), "dark mode .ai-hub-badge defined");

  // Keyframe animation
  assert.ok(css.includes("@keyframes aiHubFadeIn"), "@keyframes aiHubFadeIn defined for entrance");
  assert.ok(css.includes(".ai-hub-view"), ".ai-hub-view class defined");
  assert.ok(css.includes(".ai-hub-tagline"), ".ai-hub-tagline styling defined");
  assert.ok(css.includes('[data-theme="dark"] .ai-hub-tagline'), "dark mode tagline defined");

  // Centered input bar and chips
  assert.ok(css.includes(".ai-hub-input-bar"), ".ai-hub-input-bar styling defined");
  assert.ok(css.includes(".ai-hub-chip"), ".ai-hub-chip styling defined");
  assert.ok(css.includes(".ai-hub-chip-icon"), ".ai-hub-chip-icon styling defined");
  assert.ok(css.includes(".ai-hub-disabled-send-btn"), ".ai-hub-disabled-send-btn styling defined");
  assert.ok(css.includes(".ai-hub-disabled-input"), ".ai-hub-disabled-input styling defined");
  assert.ok(css.includes(".ai-hub-cards-grid"), ".ai-hub-cards-grid styling defined");
  assert.ok(css.includes(".ai-hub-card"), ".ai-hub-card styling defined");

  // FAQ card styling
  assert.ok(css.includes(".ai-hub-faq-card"), ".ai-hub-faq-card styling defined");
  assert.ok(css.includes(".ai-hub-faq-summary"), ".ai-hub-faq-summary styling defined");
  assert.ok(css.includes(".ai-hub-faq-body"), ".ai-hub-faq-body styling defined");
  assert.ok(css.includes(".ai-hub-faq-item"), ".ai-hub-faq-item styling defined");
  assert.ok(css.includes(".ai-hub-faq-link"), ".ai-hub-faq-link styling defined");
  assert.ok(css.includes(".ai-hub-faq-item-note"), ".ai-hub-faq-item-note styling defined");

  // Dark mode parity
  assert.ok(css.includes('[data-theme="dark"] .ai-hub-input-bar'), "dark mode input bar defined");
  assert.ok(css.includes('[data-theme="dark"] .ai-hub-chip'), "dark mode chip defined");
  assert.ok(css.includes('[data-theme="dark"] .ai-hub-disabled-send-btn'), "dark mode send button defined");
  assert.ok(css.includes('[data-theme="dark"] .ai-hub-card'), "dark mode card defined");
  assert.ok(css.includes('[data-theme="dark"] .ai-hub-faq-card'), "dark mode FAQ card defined");

  // Mobile media queries
  assert.ok(css.includes("@media (max-width: 768px)"), "tablet breakpoint defined");
  assert.ok(css.includes("@media (max-width: 520px)"), "mobile breakpoint defined");
  assert.ok(css.includes("@media (max-width: 380px)"), "ultra-compact mobile breakpoint defined");
});

test("Main Page Teaser: SI Hub announcement card is rendered with authentic logos, exact title, and minimalist buttons", async () => {
  const azHub = TRANSLATIONS.az.aiHub;
  const enHub = TRANSLATIONS.en.aiHub;

  // 1. Translations & exact title validation
  assert.equal(
    azHub.homeCardTitle,
    "SI Hub yaxında",
    "AZ teaser title matches user prompt exactly"
  );
  assert.equal(
    enHub.homeCardTitle,
    "SI Hub coming soon",
    "EN teaser title matches accurately"
  );
  assert.ok(azHub.homeCardDesc && enHub.homeCardDesc, "homeCardDesc exists in both languages");
  assert.ok(azHub.homeCardBadge && enHub.homeCardBadge, "homeCardBadge exists in both languages");
  assert.equal(azHub.homeCardBtnLook, "Bax", "AZ Look at button label");
  assert.equal(azHub.homeCardBtnIgnore, "Keç", "AZ Ignore button label");
  assert.equal(enHub.homeCardBtnLook, "Look at", "EN Look at button label");
  assert.equal(enHub.homeCardBtnIgnore, "Ignore", "EN Ignore button label");

  // 2. script.js logic verification
  const script = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  assert.ok(script.includes("function createMainAiHubTeaserCard("), "createMainAiHubTeaserCard exists");
  assert.ok(script.includes("main-ai-hub-teaser"), "teaser card class exists");
  assert.ok(script.includes("main-ai-hub-logo-gemini"), "Gemini logo container exists");
  assert.ok(script.includes("main-ai-hub-logo-claude"), "Claude logo container exists");
  assert.ok(script.includes("main-ai-hub-btn-look"), "Look at button exists");
  assert.ok(script.includes("main-ai-hub-btn-ignore"), "Ignore button exists");
  assert.ok(script.includes("helmer_main_ai_hub_dismissed"), "session dismissal key exists");
  assert.ok(script.includes('state.view = "aiHub"'), "teaser click navigates to aiHub view");
  assert.ok(script.includes("createMainAiHubTeaserCard(isEn)"), "teaser invoked in intake and ask views");

  // 3. style.css verification
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  assert.ok(css.includes(".main-ai-hub-teaser"), ".main-ai-hub-teaser CSS defined");
  assert.ok(css.includes("mainAiHubTeaserFadeIn"), "teaser entrance animation defined");
  assert.ok(css.includes(".main-ai-hub-logos"), "logos container CSS defined");
  assert.ok(css.includes(".main-ai-hub-badge"), "teaser badge CSS defined");
  assert.ok(css.includes(".main-ai-hub-btn-look"), "Look at button CSS defined");
  assert.ok(css.includes(".main-ai-hub-btn-ignore"), "Ignore button CSS defined");
  assert.ok(css.includes('[data-theme="dark"] .main-ai-hub-teaser'), "dark mode styles defined");
});

