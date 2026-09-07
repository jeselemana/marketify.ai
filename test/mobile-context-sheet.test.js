import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { TRANSLATIONS } from "../public/i18n.js";

test("index.html contains dedicated mobile sheet overlays and header chevron indicator", async () => {
  const html = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");

  assert.ok(html.includes('id="mobileBottomSheetOverlay"'), "mobileBottomSheetOverlay is present in index.html");
  assert.ok(html.includes('id="mobileModelSheetOverlay"'), "mobileModelSheetOverlay is present in index.html");
  assert.ok(html.includes('id="askModeButton"'), "askModeButton is present in index.html");
  assert.ok(html.includes('class="mobile-mode-chevron"'), "mobile-mode-chevron is present inside askModeButton");
});

test("i18n.js contains complete contextSheet and modelSheet translations in both AZ and EN", () => {
  const azContext = TRANSLATIONS.az.ask.contextSheet;
  const enContext = TRANSLATIONS.en.ask.contextSheet;
  const azModel = TRANSLATIONS.az.ask.modelSheet;
  const enModel = TRANSLATIONS.en.ask.modelSheet;

  assert.ok(azContext, "az.ask.contextSheet is defined");
  assert.ok(enContext, "en.ask.contextSheet is defined");
  assert.ok(azModel, "az.ask.modelSheet is defined");
  assert.ok(enModel, "en.ask.modelSheet is defined");

  // Verify all required context sheet keys exist in both
  const requiredContextKeys = [
    "title",
    "files",
    "filesDesc",
    "photos",
    "photosDesc",
    "strategies",
    "strategiesDesc",
    "tasks",
    "tasksDesc",
    "deepResearch",
    "deepResearchDesc",
    "promptTemplates",
    "promptTemplatesDesc",
    "personalIntelligence",
    "personalIntelligenceOn",
    "personalIntelligenceOff",
    "clearContext",
    "back",
    "emptyStrategies",
    "emptyTasks",
  ];

  for (const key of requiredContextKeys) {
    assert.ok(typeof azContext[key] === "string" && azContext[key].length > 0, `az.ask.contextSheet.${key} is non-empty string`);
    assert.ok(typeof enContext[key] === "string" && enContext[key].length > 0, `en.ask.contextSheet.${key} is non-empty string`);
  }

  // Verify all required model sheet keys exist in both
  const requiredModelKeys = [
    "title",
    "autoTitle",
    "autoDesc",
    "flashTitle",
    "flashDesc",
    "thinkingTitle",
    "thinkingOn",
    "thinkingOff",
  ];

  for (const key of requiredModelKeys) {
    assert.ok(typeof azModel[key] === "string" && azModel[key].length > 0, `az.ask.modelSheet.${key} is non-empty string`);
    assert.ok(typeof enModel[key] === "string" && enModel[key].length > 0, `en.ask.modelSheet.${key} is non-empty string`);
  }
});

test("style.css defines mobile bottom sheet, drag handle, quick tiles, and composer model relocation", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Overlay lifecycle and ghost overlay prevention
  assert.ok(css.includes(".mobile-bottom-sheet-overlay"), ".mobile-bottom-sheet-overlay is defined");
  assert.ok(css.includes(".mobile-model-sheet-overlay"), ".mobile-model-sheet-overlay is defined");
  assert.ok(css.includes(".mobile-bottom-sheet-overlay[hidden]"), "hidden attribute prevents ghost overlays");
  assert.ok(css.includes("pointer-events: none !important"), "pointer-events none on hidden overlay");
  assert.ok(css.includes("display: none !important"), "display none on hidden overlay");

  // Sheet cards and dark theme
  assert.ok(css.includes(".mobile-action-sheet"), ".mobile-action-sheet is defined");
  assert.ok(css.includes(".mobile-model-sheet"), ".mobile-model-sheet is defined");
  assert.ok(css.includes(".mobile-sheet-drag-handle"), "drag handle is styled");
  assert.ok(css.includes(".mobile-sheet-tiles"), "quick action tiles grid is styled");
  assert.ok(css.includes(".mobile-sheet-list"), "context list is styled");
  assert.ok(css.includes(".mobile-sheet-footer"), "footer row with personal intelligence is styled");

  // Mobile composer hiding model selector pill
  assert.ok(css.includes(".ask-composer .ask-model-selector-menu"), "mobile composer hides model selector menu");
  assert.ok(css.includes(".mobile-mode-chevron"), "header chevron is styled");
  assert.ok(css.includes(".mobile-mode-model"), "header model badge is styled");
});

test("script.js implements clean lifecycle, swipe gestures, and Rule 4 compliance", async () => {
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Function declarations
  assert.ok(js.includes("function openMobileContextSheet"), "openMobileContextSheet is declared");
  assert.ok(js.includes("function closeMobileBottomSheet"), "closeMobileBottomSheet is declared");
  assert.ok(js.includes("function openMobileModelSheet"), "openMobileModelSheet is declared");
  assert.ok(js.includes("function closeMobileModelSheet"), "closeMobileModelSheet is declared");
  assert.ok(js.includes("function attachSwipeDownToClose"), "attachSwipeDownToClose is declared");
  assert.ok(js.includes("function isPersonalIntelligenceActive"), "isPersonalIntelligenceActive is declared");
  assert.ok(js.includes("function togglePersonalIntelligence"), "togglePersonalIntelligence is declared");

  // Teardown & ghost overlay elimination
  assert.ok(js.includes("overlay.replaceChildren()"), "replaceChildren cleans up DOM fragments upon close");
  assert.ok(js.includes("overlay.hidden = true"), "overlay gets hidden attribute upon close");
  assert.ok(js.includes("document.body.style.overflow = \"\""), "body overflow is unlocked upon close");

  // Event handlers
  assert.ok(js.includes("mobileBottomSheetOverlay?.addEventListener(\"click\""), "backdrop click closes context sheet");
  assert.ok(js.includes("mobileModelSheetOverlay?.addEventListener(\"click\""), "backdrop click closes model sheet");
  assert.ok(js.includes("closeMobileBottomSheet()"), "Escape keydown closes mobile sheets");
  assert.ok(js.includes("closeMobileModelSheet()"), "Escape keydown closes mobile sheets");

  assert.ok(js.includes("openMobileModelSheet"), "openMobileModelSheet is wired");
  assert.ok(js.includes("askImageFileInput"), "askImageFileInput is wired for photo/camera uploads");
});
