import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("rail-mode-toggle markup in index.html includes double-click default hint", async () => {
  const indexHtml = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");
  assert.ok(indexHtml.includes("id=\"railModeToggleButton\""), "railModeToggleButton element exists");
  assert.ok(indexHtml.includes("İkiqat klik: Ask default et"), "index.html includes double-click default hint");
});

test("style.css includes animation and styling for saved default mode", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  assert.ok(css.includes(".rail-mode-toggle.is-default-saved"), "is-default-saved class exists");
  assert.ok(css.includes("railDefaultSavedPulse"), "railDefaultSavedPulse keyframe exists");
});

test("script.js includes setDefaultWorkspaceMode, double-click handler, and persistence logic", async () => {
  const scriptJs = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  assert.ok(scriptJs.includes("function getDefaultWorkspaceMode()"), "getDefaultWorkspaceMode function defined");
  assert.ok(scriptJs.includes("async function setDefaultWorkspaceMode(mode)"), "setDefaultWorkspaceMode function defined");
  assert.ok(scriptJs.includes("railModeToggleButton?.addEventListener(\"click\""), "single-click handler with debounce exists");
  assert.ok(scriptJs.includes("railModeToggleButton?.addEventListener(\"dblclick\""), "double-click listener attached");
  assert.ok(!scriptJs.includes("localStorage.setItem(\"helmer_default_mode\""), "does not persist defaultMode to localStorage");
  assert.ok(scriptJs.includes("setCookie(\"helmer_default_mode\", mode)"), "persists defaultMode via cookie");
  assert.ok(scriptJs.includes("authRequest(\"/api/auth/settings\""), "persists to backend user settings in Cloudflare R2");
});
