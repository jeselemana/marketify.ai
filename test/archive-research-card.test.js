import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { TRANSLATIONS } from "../public/i18n.js";

test("Archive Deep Research Tip Card: i18n dictionaries contain exact translations in AZ and EN", () => {
  const azArchive = TRANSLATIONS.az.archive;
  const enArchive = TRANSLATIONS.en.archive;

  assert.ok(azArchive, "archive exists in AZ translations");
  assert.ok(enArchive, "archive exists in EN translations");

  // Exact user-specified texts in AZ
  assert.equal(
    azArchive.researchTipTitle,
    "Növbəti dəfə daha az gözləmək istəyirsən?",
    "AZ research tip title matches prompt exactly"
  );
  assert.equal(
    azArchive.researchTipDesc,
    "Ask rejimində yeni Deep Research funksiyasını yoxla! Oxşar performansla sürətin sintezini əldə et.",
    "AZ research tip desc matches prompt exactly"
  );

  assert.equal(azArchive.researchTipAction, "Yoxla", "AZ research tip action label is Yoxla");
  assert.ok(azArchive.researchTipTag, "AZ research tip tag label exists");
  assert.ok(azArchive.researchTipDismiss, "AZ research tip dismiss label exists");

  assert.ok(enArchive.researchTipTitle, "EN research tip title exists");
  assert.ok(enArchive.researchTipDesc, "EN research tip desc exists");
  assert.equal(enArchive.researchTipAction, "Try it", "EN research tip action label is Try it");
  assert.ok(enArchive.researchTipTag, "EN research tip tag label exists");
  assert.ok(enArchive.researchTipDismiss, "EN research tip dismiss label exists");

  assert.equal(
    Object.keys(azArchive).sort().join(","),
    Object.keys(enArchive).sort().join(","),
    "AZ and EN archive keys match 100%"
  );
});

test("Archive Deep Research Tip Card: script.js implements card rendering, dismissal, and Ask Deep Research transition", async () => {
  const script = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Function declarations
  assert.ok(script.includes("function renderArchiveResearchCard("), "renderArchiveResearchCard function declared");
  assert.ok(script.includes("function goToAskDeepResearch("), "goToAskDeepResearch function declared");

  // Deep research activation & navigation
  assert.ok(script.includes('setMode("ask")'), "switches to ask mode");
  assert.ok(script.includes('"deep-research"'), "enables deep-research plugin in state");

  // Dismissal persistence
  assert.ok(script.includes("helmer_archive_research_card_dismissed"), "checks dismissal key");
  assert.ok(script.includes('localStorage.setItem("helmer_archive_research_card_dismissed", "1")'), "persists dismissal to localStorage");

  // Classes & integration in renderStrategyList
  assert.ok(script.includes("archive-research-card"), "card class used");
  assert.ok(script.includes("archive-research-card-icon"), "icon container used");
  assert.ok(script.includes('circle cx="11" cy="11" r="7.5"'), "high quality search icon used");
  assert.ok(script.includes("archive-research-card-actions"), "actions class used");
  assert.ok(script.includes("archive-research-card-btn"), "btn class used");
  assert.ok(!script.includes("archive-research-card-btn-arrow"), "arrow icon is removed from button");
  assert.ok(!script.includes("archive-research-card-badge"), "chip badge is removed from card");
  assert.ok(script.includes("archive-research-card-close"), "close button class used");
  assert.ok(script.includes("renderArchiveResearchCard(isEn)"), "invoked in renderStrategyList");
});

test("Archive Deep Research Tip Card: style.css defines minimalist card, dark mode, and mobile responsiveness", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  assert.ok(css.includes(".archive-research-card"), ".archive-research-card CSS selector present");
  assert.ok(css.includes(".archive-research-card-title"), ".archive-research-card-title CSS selector present");
  assert.ok(css.includes(".archive-research-card-desc"), ".archive-research-card-desc CSS selector present");
  assert.ok(css.includes(".archive-research-card-btn"), ".archive-research-card-btn CSS selector present");
  assert.ok(css.includes(".archive-research-card-close"), ".archive-research-card-close CSS selector present");

  // Dark mode
  assert.ok(css.includes(".archive-research-card-title"), "dark mode title style exists");
  assert.ok(css.includes("[data-theme=\"dark\"] .archive-research-card"), "dark mode for card exists");

  // Mobile responsiveness
  assert.ok(css.includes("@media (max-width: 767px)"), "standard mobile breakpoint exists");
});
