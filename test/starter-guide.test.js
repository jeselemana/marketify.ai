import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { TRANSLATIONS } from "../public/i18n.js";

test("Starter Guide i18n: translations dictionaries contain complete starterGuide keys in AZ and EN", () => {
  const azGuide = TRANSLATIONS.az.starterGuide;
  const enGuide = TRANSLATIONS.en.starterGuide;

  assert.ok(azGuide, "starterGuide exists in AZ translations");
  assert.ok(enGuide, "starterGuide exists in EN translations");

  const requiredKeys = [
    "buildCardTitle",
    "buildCardSubtitle",
    "buildCardBadge",
    "askCardTitle",
    "askCardSubtitle",
    "askCardBadge",
    "ariaRegion",
    "buildCardAria",
    "askCardAria",
    "modalTitleBuild",
    "modalTitleAsk",
    "tabBuild",
    "tabAsk",
    "principleHeading",
    "buildPrinciple",
    "askPrinciple",
    "stepsHeading",
    "buildStep1Title",
    "buildStep1Desc",
    "buildStep2Title",
    "buildStep2Desc",
    "buildStep3Title",
    "buildStep3Desc",
    "askStep1Title",
    "askStep1Desc",
    "askStep2Title",
    "askStep2Desc",
    "askStep3Title",
    "askStep3Desc",
    "examplesHeading",
    "buildExample1",
    "buildExample2",
    "buildExample3",
    "askExample1",
    "askExample2",
    "askExample3",
    "btnStartBuild",
    "btnStartAsk",
    "modalCloseAria",
    "dismissAria",
  ];

  for (const key of requiredKeys) {
    assert.ok(azGuide[key], `AZ key missing or empty: ${key}`);
    assert.ok(enGuide[key], `EN key missing or empty: ${key}`);
  }

  assert.equal(
    Object.keys(azGuide).sort().join(","),
    Object.keys(enGuide).sort().join(","),
    "AZ and EN starterGuide keys match 100%"
  );
});

test("Starter Guide DOM: index.html contains #guideModalOverlay", async () => {
  const html = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");
  assert.ok(html.includes('id="guideModalOverlay"'), "guideModalOverlay exists in index.html");
  assert.ok(html.includes('class="guide-modal-overlay"'), "guide-modal-overlay class present");
  assert.ok(html.includes('hidden'), "guideModalOverlay has hidden attribute");
});

test("Starter Guide JS: script.js implements mode-specific card, dismiss persistence, and modals", async () => {
  const script = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Functions existence
  assert.ok(script.includes("function createHomeGuideCards("), "createHomeGuideCards function declared");
  assert.ok(script.includes("function openGuideModal("), "openGuideModal function declared");
  assert.ok(script.includes("function closeGuideModal("), "closeGuideModal function declared");

  // Mode-isolated card logic
  assert.ok(script.includes('const isBuild = currentMode === "build"'), "distinguishes currentMode");
  assert.ok(script.includes("helmer_guide_dismissed_build"), "checks build dismissal key");
  assert.ok(script.includes("helmer_guide_dismissed_ask"), "checks ask dismissal key");

  // Dismiss button and permanent removal
  assert.ok(script.includes("home-guide-card-close"), "home-guide-card-close button class used");
  assert.ok(script.includes('localStorage.setItem(storageKey, "1")'), "persists permanent dismissal to localStorage");

  // Elements and classes
  assert.ok(script.includes("home-guide-cards"), "home-guide-cards class used");
  assert.ok(script.includes("home-guide-card-actions"), "home-guide-card-actions class used");
  assert.ok(script.includes("guide-modal-card"), "guide-modal-card class used");
  assert.ok(script.includes("guide-modal-tabs"), "guide-modal-tabs class used");
  assert.ok(script.includes("guide-modal-step-item"), "guide-modal-step-item class used");
  assert.ok(script.includes("guide-modal-example-chip"), "guide-modal-example-chip class used");

  // Integrated in views below the composer input form
  assert.ok(script.includes('createHomeGuideCards(isEn, "build")'), "invoked in renderIntake (Build)");
  assert.ok(script.includes('createHomeGuideCards(isEn, "ask")'), "invoked in renderAsk (Ask)");
  assert.ok(script.includes("composerArea.append(form, helper, guideCards)"), "card placed below disclaimer in composerArea");

  // Overlay event listener and Esc key handling
  assert.ok(script.includes("guideModalOverlay?.addEventListener"), "guideModalOverlay backdrop click wired");
  assert.ok(script.includes("closeGuideModal()"), "closeGuideModal called on Esc or close");
});

test("Starter Guide CSS: style.css defines minimalist cards, dismiss button, and dark mode", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  assert.ok(css.includes(".home-guide-cards"), ".home-guide-cards CSS selector present");
  assert.ok(css.includes(".home-guide-card"), ".home-guide-card CSS selector present");
  assert.ok(css.includes(".home-guide-card-actions"), ".home-guide-card-actions CSS selector present");
  assert.ok(css.includes(".home-guide-card-close"), ".home-guide-card-close CSS selector present");
  assert.ok(css.includes(".guide-modal-overlay"), ".guide-modal-overlay CSS selector present");
  assert.ok(css.includes(".guide-modal-card"), ".guide-modal-card CSS selector present");

  // Dark mode
  assert.ok(css.includes('[data-theme="dark"] .home-guide-card'), "dark mode styles for cards present");
  assert.ok(css.includes('[data-theme="dark"] .home-guide-card-close:hover'), "dark mode styles for close button present");
  assert.ok(css.includes('[data-theme="dark"] .guide-modal-card'), "dark mode styles for modal present");

  // Typing hide
  assert.ok(css.includes(".ask-shell.is-empty.has-input .home-guide-cards"), "cards hide when user types");

  // Mobile responsive
  assert.ok(css.includes("@media (max-width: 767px)"), "standard mobile breakpoint present");
  assert.ok(css.includes("@media (max-width: 380px)"), "compact mobile breakpoint present");
});

