import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { t, TRANSLATIONS } from "../public/i18n.js";

test("i18n: rail archive hover keys have 100% key parity and correct translations in AZ and EN", () => {
  const azArchive = TRANSLATIONS.az.archive;
  const enArchive = TRANSLATIONS.en.archive;

  const expectedKeys = ["viewAll", "recentStrategies", "noStrategiesYet"];

  for (const key of expectedKeys) {
    assert.ok(key in azArchive, `AZ archive translations must contain ${key}`);
    assert.ok(key in enArchive, `EN archive translations must contain ${key}`);
    assert.ok(typeof azArchive[key] === "string" && azArchive[key].trim().length > 0);
    assert.ok(typeof enArchive[key] === "string" && enArchive[key].trim().length > 0);
  }

  // Azerbaijani copy check
  assert.equal(t("archive.viewAll", {}, "az"), "Hamısına bax");
  assert.equal(t("archive.recentStrategies", {}, "az"), "Son strategiyalar");
  assert.equal(t("archive.noStrategiesYet", {}, "az"), "Hələ strategiya yoxdur");

  // English copy check
  assert.equal(t("archive.viewAll", {}, "en"), "View all");
  assert.equal(t("archive.recentStrategies", {}, "en"), "Recent strategies");
  assert.equal(t("archive.noStrategiesYet", {}, "en"), "No strategies yet");
});

test("index.html: railStrategiesButton is wrapped in railArchiveContainer with railArchivePopover", async () => {
  const htmlContent = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");

  assert.ok(htmlContent.includes('id="railArchiveContainer"'), "index.html defines #railArchiveContainer");
  assert.ok(htmlContent.includes('id="railStrategiesButton"'), "index.html defines #railStrategiesButton");
  assert.ok(htmlContent.includes('id="railArchivePopover"'), "index.html defines #railArchivePopover");
  assert.ok(
    htmlContent.includes('class="rail-archive-container" id="railArchiveContainer"'),
    "rail-archive-container wrapper wraps rail strategies section"
  );
  assert.ok(
    htmlContent.includes('class="rail-archive-popover" id="railArchivePopover" role="menu" aria-label="Son strategiyalar" hidden'),
    "railArchivePopover has proper role and hidden attribute"
  );
});

test("script.js: rail archive popover functions are defined, called, and strictly adhere to XSS Rule 4", async () => {
  const scriptContent = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Function definitions
  assert.ok(scriptContent.includes("function renderRailArchivePopover()"), "renderRailArchivePopover is defined");
  assert.ok(scriptContent.includes("function showRailArchivePopover()"), "showRailArchivePopover is defined");
  assert.ok(scriptContent.includes("function hideRailArchivePopover("), "hideRailArchivePopover is defined");
  assert.ok(scriptContent.includes("function setupRailArchiveHover()"), "setupRailArchiveHover is defined");

  // Wiring
  assert.ok(scriptContent.includes("setupRailArchiveHover();"), "setupRailArchiveHover is called on initialization");
  assert.ok(scriptContent.includes("hideRailArchivePopover(true);"), "hideRailArchivePopover is called on click and dismissal");

  // Slices top 3 strategies
  assert.ok(
    scriptContent.includes(".slice(0, 3)"),
    "Popover extracts only the last 3 strategies (slice(0, 3))"
  );

  // View all action opens Archive
  assert.ok(
    scriptContent.includes('state.view = "list"') && scriptContent.includes("syncNav()"),
    "Clicking view all navigates to Archive list view"
  );

  // Rule 4: Frontend XSS Protection - Safe rendering of dynamic titles and dates
  assert.ok(
    scriptContent.includes('element(\n        "span",\n        "rail-archive-popover-item-title"') ||
      scriptContent.includes('element("span", "rail-archive-popover-item-title"'),
    "Strategy title is safely rendered via element() helper"
  );
  assert.ok(
    scriptContent.includes('element(\n        "span",\n        "rail-archive-popover-item-date"') ||
      scriptContent.includes('element("span", "rail-archive-popover-item-date"'),
    "Date is safely rendered via element() helper"
  );
  assert.ok(
    scriptContent.includes('element("span", "rail-archive-popover-all-label", t("archive.viewAll"))'),
    "View all text is rendered safely using t('archive.viewAll')"
  );

  // Dynamic user data must NEVER be passed to innerHTML
  assert.ok(
    !scriptContent.includes(".innerHTML = strat.title") &&
      !scriptContent.includes(".innerHTML = `${strat.title}") &&
      !scriptContent.includes('.innerHTML = `<span class="rail-archive-popover-item-title">${strat.title}'),
    "Rule 4: innerHTML is NEVER used for dynamic strategy records"
  );
});

test("style.css: rail-archive-popover classes, floating positioning, hover bridge, and dark mode are defined", async () => {
  const styleContent = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  assert.ok(styleContent.includes(".rail-archive-container {"), ".rail-archive-container class is defined");
  assert.ok(styleContent.includes(".rail-archive-popover {"), ".rail-archive-popover class is defined");
  assert.ok(styleContent.includes(".rail-archive-popover.is-visible {"), ".rail-archive-popover.is-visible class is defined");
  assert.ok(styleContent.includes(".rail-archive-popover::before {"), "Hover bridge pseudo-element is defined");
  assert.ok(styleContent.includes(".rail-archive-popover-item {"), ".rail-archive-popover-item class is defined");
  assert.ok(styleContent.includes(".rail-archive-popover-item-title {"), ".rail-archive-popover-item-title class is defined");
  assert.ok(styleContent.includes(".rail-archive-popover-item-date {"), ".rail-archive-popover-item-date class is defined");
  assert.ok(styleContent.includes(".rail-archive-popover-empty {"), ".rail-archive-popover-empty class is defined");
  assert.ok(styleContent.includes(".rail-archive-popover-all {"), ".rail-archive-popover-all class is defined");

  // Desktop tooltip override
  assert.ok(
    styleContent.includes("#railStrategiesButton::after {\n    display: none !important;\n  }") ||
      styleContent.includes("#railStrategiesButton::after { display: none !important; }") ||
      styleContent.includes("#railStrategiesButton::after"),
    "Tooltip is suppressed on desktop in favor of the rich preview popover"
  );

  // Dark mode support
  assert.ok(
    styleContent.includes(':root[data-theme="dark"] .rail-archive-popover'),
    "Dark mode styles are defined for rail-archive-popover"
  );

  // Button children pointer-events: none to ensure clicks hit the button directly
  assert.ok(
    styleContent.includes(".rail-archive-popover-item > *") &&
      styleContent.includes(".rail-archive-popover-all > *"),
    "Popover button children have pointer-events: none"
  );
});

test("script.js: popover click handlers stopPropagation, focusout is deferred, and closeAllArchiveMenus does not break popover clicks", async () => {
  const scriptContent = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // e.stopPropagation on buttons
  assert.ok(
    scriptContent.includes("e.stopPropagation();\n        hideRailArchivePopover(true);\n        openSavedStrategy(strat.id);"),
    "Strategy item click handler stops propagation and opens strategy"
  );
  assert.ok(
    scriptContent.includes("e.stopPropagation();\n    hideRailArchivePopover(true);\n    state.view = \"list\";"),
    "View all button click handler stops propagation and sets list view"
  );

  // closeAllArchiveMenus must NOT call hideRailArchivePopover(true)
  assert.ok(
    !scriptContent.includes("function closeAllArchiveMenus() {\n  hideRailArchivePopover(true);"),
    "closeAllArchiveMenus does not close the popover on every click in document"
  );

  // focusout must be deferred to prevent mousedown blur from dropping clicks on macOS
  assert.ok(
    scriptContent.includes('container.addEventListener("focusout"') &&
      scriptContent.includes("setTimeout"),
    "focusout listener is deferred via setTimeout to prevent dropped clicks"
  );
});

test("script.js: showRailArchivePopover suppresses preview on archive page (state.view === 'list') and prevents re-rendering when already open", async () => {
  const scriptContent = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Gating on archive page
  assert.ok(
    scriptContent.includes('if (state.view === "list") return;'),
    "showRailArchivePopover returns immediately when on the archive page"
  );

  // Preventing re-render when open
  assert.ok(
    scriptContent.includes('if (!popover.hidden && popover.classList.contains("is-visible")) {\n    return;\n  }'),
    "showRailArchivePopover does not re-render if popover is already visible"
  );

  // focusin only triggers on the archive button itself
  assert.ok(
    scriptContent.includes('if (e.target === btn) {\n      showRailArchivePopover();\n    }'),
    "focusin only triggers popover when the archive button itself is focused"
  );
});
