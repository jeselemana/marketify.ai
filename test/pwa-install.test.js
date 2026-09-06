import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { t, TRANSLATIONS } from "../public/i18n.js";

test("index.html: installAppNav is placed immediately after limitsNav in sidebar navigation", async () => {
  const indexHtml = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");

  assert.ok(indexHtml.includes('id="installAppNav"'), "installAppNav element exists");
  assert.ok(indexHtml.includes('id="limitsNav"'), "limitsNav element exists");

  const limitsIndex = indexHtml.indexOf('id="limitsNav"');
  const installIndex = indexHtml.indexOf('id="installAppNav"');
  const settingsIndex = indexHtml.indexOf('id="settingsNav"');

  assert.ok(limitsIndex !== -1, "limitsNav found");
  assert.ok(installIndex !== -1, "installAppNav found");
  assert.ok(settingsIndex !== -1, "settingsNav found");
  assert.ok(limitsIndex < installIndex, "limitsNav precedes installAppNav");
  assert.ok(installIndex < settingsIndex, "installAppNav precedes settingsNav (directly under Usage)");

  assert.ok(indexHtml.includes("Tətbiqi yüklə"), "installAppNav contains Azerbaijani default text 'Tətbiqi yüklə'");
});

test("index.html: railInstallAppButton is placed immediately after railLimitsButton in rail navigation", async () => {
  const indexHtml = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");

  assert.ok(indexHtml.includes('id="railInstallAppButton"'), "railInstallAppButton exists");
  assert.ok(indexHtml.includes('id="railLimitsButton"'), "railLimitsButton exists");

  const railLimitsIndex = indexHtml.indexOf('id="railLimitsButton"');
  const railInstallIndex = indexHtml.indexOf('id="railInstallAppButton"');

  assert.ok(railLimitsIndex < railInstallIndex, "railLimitsButton precedes railInstallAppButton");
});

test("index.html: installAppModalOverlay is declared alongside modal overlays", async () => {
  const indexHtml = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");
  assert.ok(indexHtml.includes('id="installAppModalOverlay"'), "installAppModalOverlay exists in index.html");
  assert.ok(indexHtml.includes('class="install-app-modal-overlay"'), "has correct CSS class");
});

test("i18n: nav.installApp and installModal have 100% key parity and correct translations", () => {
  assert.equal(t("nav.installApp", {}, "az"), "Tətbiqi yüklə");
  assert.equal(t("nav.installApp", {}, "en"), "Install App");

  assert.ok(TRANSLATIONS.az.installModal, "TRANSLATIONS.az contains installModal");
  assert.ok(TRANSLATIONS.en.installModal, "TRANSLATIONS.en contains installModal");

  const azModalKeys = Object.keys(TRANSLATIONS.az.installModal).sort();
  const enModalKeys = Object.keys(TRANSLATIONS.en.installModal).sort();

  assert.deepEqual(azModalKeys, enModalKeys, "installModal has exact key parity between AZ and EN");

  // Verify key steps exist in both languages
  const requiredKeys = [
    "title",
    "subtitle",
    "installedSuccess",
    "alreadyInstalledToast",
    "closeAria",
    "understandBtn",
    "iosBadge",
    "iosStep1Title",
    "iosStep1Desc",
    "iosStep2Title",
    "iosStep2Desc",
    "iosStep3Title",
    "iosStep3Desc",
    "androidBadge",
    "androidStep1Title",
    "androidStep1Desc",
    "androidStep2Title",
    "androidStep2Desc",
    "androidStep3Title",
    "androidStep3Desc",
    "desktopBadge",
    "desktopStep1Title",
    "desktopStep1Desc",
    "desktopStep2Title",
    "desktopStep2Desc",
    "desktopStep3Title",
    "desktopStep3Desc",
  ];

  for (const key of requiredKeys) {
    assert.ok(TRANSLATIONS.az.installModal[key], `AZ missing installModal key: ${key}`);
    assert.ok(TRANSLATIONS.en.installModal[key], `EN missing installModal key: ${key}`);
  }
});

test("script.js: PWA installation and event listeners are registered", async () => {
  const scriptJs = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  assert.ok(scriptJs.includes("beforeinstallprompt"), "listens to beforeinstallprompt event");
  assert.ok(scriptJs.includes("appinstalled"), "listens to appinstalled event");
  assert.ok(scriptJs.includes("function isAppInstalled()"), "isAppInstalled function defined");
  assert.ok(scriptJs.includes("(display-mode: standalone)"), "checks standalone display mode");
  assert.ok(scriptJs.includes("navigator.standalone"), "checks iOS navigator.standalone");
  assert.ok(scriptJs.includes("android-app://"), "checks android-app referrer");
  assert.ok(scriptJs.includes("function updateInstallButtonVisibility()"), "updateInstallButtonVisibility defined");
  assert.ok(scriptJs.includes("function getDevicePlatform()"), "getDevicePlatform defined");
  assert.ok(scriptJs.includes("function handleInstallAppClick()"), "handleInstallAppClick defined");
  assert.ok(scriptJs.includes("function openInstallAppModal("), "openInstallAppModal defined");
  assert.ok(scriptJs.includes("function closeInstallAppModal()"), "closeInstallAppModal defined");
});

test("script.js: platform detection identifies iOS, Android, and Desktop", async () => {
  const scriptJs = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  assert.ok(scriptJs.includes("iPad|iPhone|iPod"), "detects iOS devices via userAgent regex");
  assert.ok(scriptJs.includes("maxTouchPoints > 1"), "detects modern iPadOS via maxTouchPoints");
  assert.ok(scriptJs.includes("/Android/i"), "detects Android devices");
});

test("script.js: modal construction complies with Frontend XSS rules (Rule 4)", async () => {
  const scriptJs = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Extract modal construction helper and openInstallAppModal body
  const startIndex = scriptJs.indexOf("function createInstallSvgIcon(");
  assert.ok(startIndex !== -1, "createInstallSvgIcon found");
  const endIndex = scriptJs.indexOf("function closeInstallAppModal()");
  assert.ok(endIndex !== -1, "closeInstallAppModal found");
  const modalFnCode = scriptJs.slice(startIndex, endIndex);

  // Must not assign raw innerHTML to construct text or dynamic content
  assert.ok(!modalFnCode.includes(".innerHTML ="), "modal creation does not use raw innerHTML");
  assert.ok(modalFnCode.includes("createElementNS"), "uses safe SVG elements");
  assert.ok(modalFnCode.includes("createTextNode"), "uses safe text nodes");
  assert.ok(modalFnCode.includes("element("), "uses safe element helper");
});

test("script.js: navigation click listeners and Escape shortcuts are bound", async () => {
  const scriptJs = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  assert.ok(scriptJs.includes("installAppNav?.addEventListener(\"click\""), "click listener on installAppNav");
  assert.ok(scriptJs.includes("railInstallAppButton?.addEventListener(\"click\""), "click listener on railInstallAppButton");
  assert.ok(scriptJs.includes("installAppModalOverlay?.addEventListener(\"click\""), "click listener on installAppModalOverlay");
  assert.ok(scriptJs.includes("closeInstallAppModal()"), "Escape key handler invokes closeInstallAppModal()");
});

test("style.css: PWA install modal styles and dark mode overrides are defined", async () => {
  const styleCss = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  assert.ok(styleCss.includes(".install-app-modal-overlay"), "overlay styles defined");
  assert.ok(styleCss.includes("backdrop-filter: blur(8px)"), "backdrop blur enabled");
  assert.ok(styleCss.includes(".install-app-modal-card"), "card styles defined");
  assert.ok(styleCss.includes(".install-step-item"), "step item styles defined");
  assert.ok(styleCss.includes(".install-step-num"), "step number styles defined");
  assert.ok(styleCss.includes(".install-step-action-pill"), "action pill styles defined");
  assert.ok(styleCss.includes("html.dark .install-app-modal-card"), "dark mode card style defined");
  assert.ok(styleCss.includes("html.dark .install-step-item"), "dark mode step item style defined");
});
