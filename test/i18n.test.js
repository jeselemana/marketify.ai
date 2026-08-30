import test from "node:test";
import assert from "node:assert/strict";
import {
  t,
  getLanguage,
  setLanguage,
  formatDate,
  formatNumber,
  TRANSLATIONS,
  LEGAL_DOCS_I18N,
} from "../public/i18n.js";

test("i18n: translations dictionaries have 100% key parity between AZ and EN", () => {
  const azKeys = Object.keys(TRANSLATIONS.az).sort();
  const enKeys = Object.keys(TRANSLATIONS.en).sort();

  assert.equal(azKeys.length, enKeys.length, `Mismatch in translation key counts: AZ has ${azKeys.length}, EN has ${enKeys.length}`);

  const missingInEn = azKeys.filter((k) => !(k in TRANSLATIONS.en));
  const missingInAz = enKeys.filter((k) => !(k in TRANSLATIONS.az));

  assert.deepEqual(missingInEn, [], `Keys present in AZ but missing in EN: ${missingInEn.join(", ")}`);
  assert.deepEqual(missingInAz, [], `Keys present in EN but missing in AZ: ${missingInAz.join(", ")}`);
});

test("i18n: t() returns correct translations for both languages", () => {
  assert.equal(t("nav.archive", {}, "az"), "Arxiv");
  assert.equal(t("nav.archive", {}, "en"), "Archive");

  assert.equal(t("nav.planner", {}, "az"), "Planlaşdırılanlar");
  assert.equal(t("nav.planner", {}, "en"), "Planner");

  assert.equal(t("intake.title", {}, "az"), "Biznes məqsədini strategiyaya çevir.");
  assert.equal(t("intake.title", {}, "en"), "Turn your business goal into an execution strategy.");
});

test("i18n: t() interpolates parameters correctly", () => {
  assert.equal(
    t("strategy.versionBadge", { version: 2 }, "az"),
    "v2"
  );
  assert.equal(
    t("strategy.versionBadge", { version: 2 }, "en"),
    "v2"
  );
  assert.equal(
    t("clarification.questionCounter", { current: 1, total: 3 }, "az"),
    "Sual 1 / 3"
  );
  assert.equal(
    t("clarification.questionCounter", { current: 1, total: 3 }, "en"),
    "Question 1 of 3"
  );
});

test("i18n: t() falls back gracefully to default language or key itself", () => {
  assert.equal(t("some.nonexistent.key", {}, "en"), "some.nonexistent.key");
});

test("i18n: LEGAL_DOCS_I18N contains Terms and Privacy in both AZ and EN", () => {
  assert.ok(LEGAL_DOCS_I18N.az.terms.title);
  assert.ok(LEGAL_DOCS_I18N.az.privacy.title);
  assert.ok(LEGAL_DOCS_I18N.en.terms.title);
  assert.ok(LEGAL_DOCS_I18N.en.privacy.title);

  assert.match(LEGAL_DOCS_I18N.en.terms.title, /Terms of Service/);
  assert.match(LEGAL_DOCS_I18N.en.privacy.title, /Privacy Policy/);
});

test("i18n: formatNumber handles locale-specific formatting", () => {
  assert.equal(formatNumber(1250, "en"), "1,250");
  assert.ok(formatNumber(0, "az") === "0");
});
