import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { t, TRANSLATIONS } from "../public/i18n.js";

test("i18n: archive background CTA banner has 100% key parity and correct translations in AZ and EN", () => {
  const azArchive = TRANSLATIONS.az.archive;
  const enArchive = TRANSLATIONS.en.archive;

  const expectedCtaKeys = ["bgCtaTitle", "bgCtaDesc", "bgCtaAction", "bgCtaDismiss", "bgCtaTag"];

  for (const key of expectedCtaKeys) {
    assert.ok(key in azArchive, `AZ archive translations must have ${key}`);
    assert.ok(key in enArchive, `EN archive translations must have ${key}`);
    assert.ok(typeof azArchive[key] === "string" && azArchive[key].trim().length > 0);
    assert.ok(typeof enArchive[key] === "string" && enArchive[key].trim().length > 0);
  }

  // Azerbaijani copy check
  assert.equal(t("archive.bgCtaTag", {}, "az"), "Vaxta qənaət");
  assert.equal(t("archive.bgCtaTitle", {}, "az"), "Vaxtın yoxdur? Generasiya səhifəsində işi Helmer-ə tapşır!");
  assert.ok(t("archive.bgCtaDesc", {}, "az").includes("İşi arxa planda davam etdir"));
  assert.ok(t("archive.bgCtaDesc", {}, "az").includes("Arxivinə"));

  // English copy check
  assert.equal(t("archive.bgCtaTag", {}, "en"), "Time-saver");
  assert.equal(t("archive.bgCtaTitle", {}, "en"), "Short on time? Let Helmer handle it on the generation page!");
  assert.ok(t("archive.bgCtaDesc", {}, "en").includes("Continue in background"));
  assert.ok(t("archive.bgCtaDesc", {}, "en").includes("Archive"));
});

test("script.js: renderArchiveBackgroundCta is declared, appends to archive view, and complies with XSS Rule 4", async () => {
  const scriptContent = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  assert.ok(scriptContent.includes("function renderArchiveBackgroundCta()"), "renderArchiveBackgroundCta function is defined");
  assert.ok(scriptContent.includes("archive-bg-cta"), "archive-bg-cta CSS class is used");
  assert.ok(scriptContent.includes("archive-bg-cta-tag"), "archive-bg-cta-tag kicker badge is rendered");
  assert.ok(scriptContent.includes("renderArchiveBackgroundCta()"), "renderArchiveBackgroundCta is called");
  assert.ok(scriptContent.includes("view.appendChild(bgCta);"), "bgCta banner is appended to archive view");

  // Rule 4: Frontend XSS Protection - Ensure text is safely rendered
  assert.ok(
    scriptContent.includes('element("strong", "archive-bg-cta-title", t("archive.bgCtaTitle"))'),
    "Title is safely rendered via element() helper"
  );
  assert.ok(
    scriptContent.includes('element("p", "archive-bg-cta-desc", t("archive.bgCtaDesc"))'),
    "Description is safely rendered via element() helper"
  );
});

test("style.css: archive-bg-cta classes, attractive styling, and dark mode overrides are defined", async () => {
  const styleContent = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  assert.ok(styleContent.includes(".archive-bg-cta {"), ".archive-bg-cta class is defined");
  assert.ok(styleContent.includes(".archive-bg-cta-tag {"), ".archive-bg-cta-tag class is defined");
  assert.ok(styleContent.includes(".archive-bg-cta-title {"), ".archive-bg-cta-title class is defined");
  assert.ok(styleContent.includes(".archive-bg-cta-desc {"), ".archive-bg-cta-desc class is defined");
  assert.ok(styleContent.includes(".archive-bg-cta-btn {"), ".archive-bg-cta-btn class is defined");
  assert.ok(styleContent.includes(".archive-bg-cta-dismiss {"), ".archive-bg-cta-dismiss class is defined");
  assert.ok(styleContent.includes(".archive-bg-cta.is-dismissed {"), ".archive-bg-cta.is-dismissed class is defined");
  assert.ok(styleContent.includes(':root[data-theme="dark"] .archive-bg-cta'), "dark theme archive cta is defined");
});

test("script.js and style.css: archive-bottom-dock is pinned at bottom with search and new button in compact form", async () => {
  const scriptContent = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  const styleContent = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // script.js checks
  assert.ok(scriptContent.includes('archive-bottom-dock'), "archive-bottom-dock is constructed in script.js");
  assert.ok(scriptContent.includes('archive-dock-search-wrap'), "archive-dock-search-wrap exists");
  assert.ok(scriptContent.includes('archive-dock-search-input'), "archive-dock-search-input exists");
  assert.ok(scriptContent.includes('archive-dock-new-btn'), "archive-dock-new-btn exists");
  assert.ok(scriptContent.includes('dock.append(searchWrap, divider, newBtn);'), "dock bundles searchWrap, divider, and newBtn");
  assert.ok(scriptContent.includes('view.appendChild(dock);'), "dock is appended to archive view");

  // style.css checks: pinned fixed bottom positioning and compact pill styling
  assert.ok(styleContent.includes('.archive-bottom-dock {'), ".archive-bottom-dock class exists in CSS");
  assert.ok(styleContent.includes('position: fixed;'), "dock is positioned fixed");
  assert.ok(styleContent.includes('bottom: 24px;'), "dock is anchored at bottom 24px on desktop");
  assert.ok(styleContent.includes('.archive-dock-search-wrap {'), "dock search wrap styling defined");
  assert.ok(styleContent.includes('.archive-dock-search-input {'), "dock search input styling defined");
  assert.ok(styleContent.includes('.archive-dock-new-btn {'), "dock new button styling defined");
  assert.ok(styleContent.includes(':root[data-theme="dark"] .archive-bottom-dock'), "dark theme dock styling defined");
  assert.ok(styleContent.includes('@media (max-width: 800px)'), "mobile media query exists for dock");
  assert.ok(styleContent.includes('font-size: 16px !important;'), "mobile search input uses 16px to prevent iOS auto-zoom");
});

test("i18n and script.js: buildSomethingNew button label is translated and used in dock and empty state", async () => {
  assert.equal(t("archive.buildSomethingNew", {}, "en"), "Build something new");
  assert.equal(t("archive.buildSomethingNew", {}, "az"), "Yeni bir şey qur");

  const scriptContent = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  assert.ok(
    scriptContent.includes('t("archive.buildSomethingNew")'),
    "script.js uses t('archive.buildSomethingNew') for new button label"
  );
});

test("style.css: archive-dock-new-btn is styled in deep navy blue", async () => {
  const styleContent = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  assert.ok(styleContent.includes('#0b1f3a'), "dock button uses deep navy blue background");
  assert.ok(styleContent.includes('#172e54'), "dock button uses dark mode navy blue override");
});



