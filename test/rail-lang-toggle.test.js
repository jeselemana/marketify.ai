import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("index.html includes rail language toggle button positioned between theme toggle and account button", async () => {
  const indexHtml = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");

  assert.ok(indexHtml.includes("id=\"railLangToggleButton\""), "railLangToggleButton element exists");
  assert.ok(indexHtml.includes("class=\"rail-button rail-lang-toggle\""), "has proper rail-button classes");
  assert.ok(indexHtml.includes("id=\"railLangBadge\""), "railLangBadge element exists");
  assert.ok(indexHtml.includes("rail-lang-icon"), "contains globe SVG icon");

  // Verify DOM order: railThemeToggleButton < railLangToggleButton < railAccountButton
  const themeIndex = indexHtml.indexOf("id=\"railThemeToggleButton\"");
  const langIndex = indexHtml.indexOf("id=\"railLangToggleButton\"");
  const accountIndex = indexHtml.indexOf("id=\"railAccountButton\"");

  assert.ok(themeIndex !== -1, "railThemeToggleButton exists");
  assert.ok(langIndex !== -1, "railLangToggleButton exists");
  assert.ok(accountIndex !== -1, "railAccountButton exists");
  assert.ok(themeIndex < langIndex, "railLangToggleButton is positioned below railThemeToggleButton");
  assert.ok(langIndex < accountIndex, "railLangToggleButton is positioned above railAccountButton");
});

test("style.css defines rail-lang-toggle spacing (8px) and dark mode styling", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  assert.ok(css.includes(".rail-lang-toggle"), ".rail-lang-toggle selector exists");
  assert.ok(css.includes(".rail-lang-badge"), ".rail-lang-badge selector exists");
  assert.match(css, /\.rail-lang-toggle\s*\{[^}]*margin-bottom:\s*8px;/s, "rail-lang-toggle defines 8px margin-bottom for uniform spacing");
  assert.ok(css.includes("[data-theme=\"dark\"] .rail-lang-toggle"), "dark mode styles rail-lang-toggle");
  assert.ok(css.includes("[data-theme=\"dark\"] .rail-lang-badge"), "dark mode styles rail-lang-badge");
});

test("script.js wires railLangToggleButton with toggle logic, nav sync, and storage listener", async () => {
  const scriptJs = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  assert.ok(scriptJs.includes("railLangToggleButton = document.querySelector(\"#railLangToggleButton\")"), "queries railLangToggleButton");
  assert.ok(scriptJs.includes("railLangBadge = document.querySelector(\"#railLangBadge\")"), "queries railLangBadge");
  assert.ok(scriptJs.includes("railLangToggleButton?.addEventListener(\"click\""), "attaches click listener");
  assert.ok(scriptJs.includes("railLangToggleButton.setAttribute(\"data-tooltip\""), "syncs tooltip in syncNav");
  assert.ok(scriptJs.includes("railLangBadge.textContent = isEn ? \"EN\" : \"AZ\""), "syncs badge text in syncNav");
  assert.ok(scriptJs.includes("event.key === \"helmer_language\""), "syncs language across tabs on storage event");
});
