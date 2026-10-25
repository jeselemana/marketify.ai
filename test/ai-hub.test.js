import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { t, TRANSLATIONS } from "../public/i18n.js";

test("Main Page Teaser: Limit policy notice replaces SI Hub teaser card in the same slot with permanent dismissal", async () => {
  const azNotice = TRANSLATIONS.az.limitPolicyNotice;
  const enNotice = TRANSLATIONS.en.limitPolicyNotice;

  assert.equal(
    azNotice.body,
    "24.10.2026-cı il tarixindən etibarən Helmer-də limit siyasətinə dəyişiklik etdik. Bildirmək istəyirik ki, bu dəyişiklik yalnız qeydiyyatsız istifadəçilər üçün nəzərdə tutulmuşdur və qeydiyyatlı hesablarda limitlər dəyişilməz olaraq saxlanılıb. Anlayışınıza görə təşəkkür edirik!"
  );
  assert.equal(azNotice.closeBtn, "Bağla");
  assert.equal(enNotice.closeBtn, "Close");

  const script = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  assert.ok(script.includes("function createMainAiHubTeaserCard("), "createMainAiHubTeaserCard exists");
  assert.ok(script.includes("main-ai-hub-teaser"), "teaser card class exists");
  assert.ok(script.includes("helmer_limit_policy_notice_dismissed"), "permanent localStorage dismissal key exists");
  assert.ok(script.includes("createMainAiHubTeaserCard(isEn)"), "teaser invoked in intake and ask views");

  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  assert.ok(css.includes(".main-ai-hub-teaser"), ".main-ai-hub-teaser CSS defined");
  assert.ok(css.includes("mainAiHubTeaserFadeIn"), "teaser entrance animation defined");
  assert.ok(css.includes(".main-ai-hub-badge"), "teaser badge CSS defined");
  assert.ok(css.includes(".main-ai-hub-btn-ignore"), "Close button CSS defined");
  assert.ok(css.includes('[data-theme="dark"] .main-ai-hub-teaser'), "dark mode styles defined");
});

