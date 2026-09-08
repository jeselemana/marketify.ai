import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("index.html: mobile top navigation bar contains native pill elements and correct layout structure", async () => {
  const html = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");

  // Header container
  assert.ok(html.includes('<header class="mobile-header">'), "mobile-header element is present");

  // Left side: Circular dark pill with 2-line menu icon (=)
  assert.ok(html.includes('id="mobileMenuButton"'), "mobileMenuButton is present");
  assert.ok(html.includes('class="mobile-menu-icon"'), "mobile-menu-icon SVG is present inside mobileMenuButton");
  assert.ok(html.includes('line x1="4" y1="8" x2="20" y2="8"'), "first horizontal line of = menu icon exists");
  assert.ok(html.includes('line x1="4" y1="16" x2="20" y2="16"'), "second horizontal line of = menu icon exists");

  // Center: Active model pill with downward chevron
  assert.ok(html.includes('class="mobile-header-center"'), "mobile-header-center container is present");
  assert.ok(html.includes('id="askModeButton"'), "askModeButton is present for model selection");
  assert.ok(html.includes('id="mobileActiveModelName"'), "mobileActiveModelName element is present");
  assert.ok(html.includes('>Helmer<'), "Initial model label defaults to Helmer");
  assert.ok(html.includes('class="mobile-mode-chevron"'), "mobile-mode-chevron is present inside askModeButton");

  // Right side: Elongated oval capsule pill with new chat and three dots
  assert.ok(html.includes('class="mobile-actions-pill"'), "mobile-actions-pill container is present");
  assert.ok(html.includes('id="mobileNewButton"'), "mobileNewButton is present inside mobile-actions-pill");
  assert.ok(html.includes('id="mobileMoreButton"'), "mobileMoreButton is present inside mobile-actions-pill");

  // Icons: New chat pencil & three dots (•••)
  assert.ok(html.includes('circle cx="5" cy="12" r="2"'), "three dots icon dot 1 exists");
  assert.ok(html.includes('circle cx="12" cy="12" r="2"'), "three dots icon dot 2 exists");
  assert.ok(html.includes('circle cx="19" cy="12" r="2"'), "three dots icon dot 3 exists");
});

test("style.css: mobile top navigation bar defines sticky position, top-down dark gradient, and native pill styles", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Desktop check: mobile header is hidden on desktop (outside @media)
  assert.ok(css.includes(".mobile-header {\n  display: none;") || css.includes(".mobile-header { display: none;"), "mobile-header is hidden on desktop");

  // Mobile Header container styles
  assert.ok(css.includes(".mobile-header {"), "mobile-header is defined");
  assert.ok(css.includes("position: sticky;"), "mobile-header uses sticky positioning");
  assert.ok(css.includes("linear-gradient(180deg, rgba(0, 0, 0,"), "mobile-header defines top-to-bottom dark gradient fade");
  assert.ok(css.includes("pointer-events: none;"), "header allows touch pass-through on empty fade areas");
  assert.ok(css.includes("pointer-events: auto;"), "buttons retain pointer-events auto");

  // Left: Circular dark pill button
  assert.ok(css.includes(".mobile-menu-pill-btn"), ".mobile-menu-pill-btn is defined");
  assert.ok(css.includes("border-radius: 50%;"), "circular pill uses 50% border radius");
  assert.ok(css.includes(".mobile-menu-icon"), ".mobile-menu-icon is styled");

  // Center: Native model pill
  assert.ok(css.includes(".mobile-model-pill-btn"), ".mobile-model-pill-btn is defined");
  assert.ok(css.includes(".mobile-active-model-name"), ".mobile-active-model-name is styled");
  assert.ok(css.includes(".mobile-mode-chevron"), ".mobile-mode-chevron is styled");
  assert.ok(css.includes("transform: rotate(180deg);"), "chevron rotates 180 degrees when model sheet is open");

  // Right: Elongated oval capsule pill
  assert.ok(css.includes(".mobile-actions-pill"), ".mobile-actions-pill is defined");
  assert.ok(css.includes(".mobile-pill-action-btn"), ".mobile-pill-action-btn is defined");
  assert.ok(css.includes(".mobile-actions-pill .mobile-new"), "mobile-new inside actions pill is styled");
  assert.ok(css.includes(".mobile-actions-pill .mobile-more-btn"), "mobile-more-btn inside actions pill is styled");

  // Dark mode parity
  assert.ok(css.includes('[data-theme="dark"] .mobile-header') || css.includes('html.dark .mobile-header'), "Dark mode mobile-header styling is defined");
  assert.ok(css.includes('[data-theme="dark"] .mobile-actions-pill') || css.includes('html.dark .mobile-actions-pill'), "Dark mode mobile actions pill styling is defined");
});

test("script.js: wires model dropdown trigger, profile more menu, and dynamically updates model name without raw innerHTML (Rule 4)", async () => {
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Event handler for mobile more button (•••)
  assert.ok(js.includes('document.querySelector("#mobileMoreButton")?.addEventListener("click"'), "mobileMoreButton click listener is attached");
  assert.ok(js.includes("openUserProfileMenu(document.querySelector(\"#mobileMoreButton\"))"), "mobileMoreButton opens user profile menu");

  // Event handler for askModeButton (model pill trigger)
  assert.ok(js.includes("openMobileModelSheet()"), "openMobileModelSheet is called on model trigger click");

  // updateMobileActiveModelName function
  assert.ok(js.includes("function updateMobileActiveModelName()"), "updateMobileActiveModelName is declared");
  assert.ok(js.includes('el.textContent = isFlash ? "Flash" : "Helmer"'), "Model name is safely set using textContent per Rule 4");
  assert.ok(!js.includes('mobileActiveModelName.innerHTML ='), "Raw innerHTML is never used for model name");

  // Open / close state toggling on askModeButton
  assert.ok(js.includes('askBtn.classList.add("is-open")'), "askBtn adds is-open class when sheet opens");
  assert.ok(js.includes('askBtn.classList.remove("is-open")'), "askBtn removes is-open class when sheet closes");

  // Localization sync
  assert.ok(js.includes('document.querySelector("#mobileMoreButton")'), "syncLanguageControls handles mobileMoreButton");
  assert.ok(js.includes('document.querySelector("#mobileMenuButton")'), "syncLanguageControls handles mobileMenuButton");
});
