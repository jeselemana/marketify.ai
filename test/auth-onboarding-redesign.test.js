import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { OnboardingSchema } from "../src/auth/validation.js";
import { createAuthRouter, publicUser } from "../src/http/auth-router.js";
import { TRANSLATIONS } from "../public/i18n.js";

test("OnboardingSchema enforces strict validation and supports role, goal, focus, skipped (Rule 2)", () => {
  // Valid personalization payload
  const valid = OnboardingSchema.safeParse({
    role: "Marketinq",
    goal: "Strategiya qurmaq",
    focus: "strategy",
  });
  assert.ok(valid.success, "Should accept valid role and goal payload");
  assert.equal(valid.data.role, "Marketinq");
  assert.equal(valid.data.goal, "Strategiya qurmaq");
  assert.equal(valid.data.focus, "strategy");

  // Valid skip payload
  const validSkip = OnboardingSchema.safeParse({ skipped: true });
  assert.ok(validSkip.success, "Should accept skipped: true");
  assert.equal(validSkip.data.skipped, true);

  // Backward compatibility with legacy focus field
  const legacyFocus = OnboardingSchema.safeParse({ focus: "business" });
  assert.ok(legacyFocus.success, "Should accept legacy focus field");

  // Rejection of unknown / mass assignment fields (Rule 2)
  const injected = OnboardingSchema.safeParse({
    role: "Marketinq",
    goal: "Strategiya qurmaq",
    passwordHash: "evil_hash",
    roleAdmin: "admin",
  });
  assert.ok(!injected.success, "Strict validation must reject unwhitelisted fields");
});

test("i18n contains onboarding translations in both Azerbaijani and English", () => {
  const az = TRANSLATIONS.az.auth.onboarding;
  assert.ok(az, "Azerbaijani onboarding translations exist");
  assert.ok(az.stepBadge, "AZ stepBadge exists");
  assert.match(az.stepBadge, /2 \/ 3/, "AZ stepBadge reflects step 2 of 3");
  assert.ok(az.welcomeTitle, "AZ welcomeTitle exists");
  assert.ok(az.roleLabel, "AZ roleLabel exists");
  assert.ok(az.roles.marketing.title, "AZ marketing title exists");
  assert.ok(az.roles.startup.title, "AZ startup title exists");
  assert.ok(az.roles.business.title, "AZ business title exists");
  assert.ok(az.roles.ecommerce.title, "AZ ecommerce title exists");
  assert.ok(az.roles.freelance.title, "AZ freelance title exists");
  assert.ok(az.goalLabel, "AZ goalLabel exists");
  assert.ok(az.goals.strategy.title, "AZ strategy title exists");
  assert.ok(az.goals.content.title, "AZ content title exists");
  assert.ok(az.goals.execution.title, "AZ execution title exists");
  assert.ok(az.continueBtn, "AZ continueBtn exists");
  assert.ok(az.skipBtn, "AZ skipBtn exists");

  const en = TRANSLATIONS.en.auth.onboarding;
  assert.ok(en, "English onboarding translations exist");
  assert.ok(en.stepBadge, "EN stepBadge exists");
  assert.match(en.stepBadge, /2 of 3/, "EN stepBadge reflects step 2 of 3");
  assert.ok(en.welcomeTitle, "EN welcomeTitle exists");
  assert.ok(en.roleLabel, "EN roleLabel exists");
  assert.ok(en.roles.marketing.title, "EN marketing title exists");
  assert.ok(en.roles.startup.title, "EN startup title exists");
  assert.ok(en.roles.business.title, "EN business title exists");
  assert.ok(en.roles.ecommerce.title, "EN ecommerce title exists");
  assert.ok(en.roles.freelance.title, "EN freelance title exists");
  assert.ok(en.goalLabel, "EN goalLabel exists");
  assert.ok(en.goals.strategy.title, "EN strategy title exists");
  assert.ok(en.goals.content.title, "EN content title exists");
  assert.ok(en.goals.execution.title, "EN execution title exists");
  assert.ok(en.continueBtn, "EN continueBtn exists");
  assert.ok(en.skipBtn, "EN skipBtn exists");

  // Check signup step badges (Step 1 of 3)
  assert.ok(TRANSLATIONS.az.auth.signup.stepBadge, "AZ signup step badge exists");
  assert.match(TRANSLATIONS.az.auth.signup.stepBadge, /1 \/ 3/, "AZ signup badge reflects step 1 of 3");
  assert.ok(TRANSLATIONS.en.auth.signup.stepBadge, "EN signup step badge exists");
  assert.match(TRANSLATIONS.en.auth.signup.stepBadge, /1 of 3/, "EN signup badge reflects step 1 of 3");

  // Check Step 3 Workspace Overview translations in AZ and EN
  const azOverview = TRANSLATIONS.az.auth.overview;
  assert.ok(azOverview, "AZ overview translations exist");
  assert.match(azOverview.stepBadge, /3 \/ 3/, "AZ overview badge reflects step 3 of 3");
  assert.ok(azOverview.title, "AZ overview title exists");
  assert.ok(azOverview.subtitle, "AZ overview subtitle exists");
  assert.ok(azOverview.cards.strategy.title, "AZ overview strategy title exists");
  assert.ok(azOverview.cards.execution.title, "AZ overview execution title exists");
  assert.ok(azOverview.cards.workflow.title, "AZ overview workflow title exists");
  assert.ok(azOverview.enterBtn, "AZ overview enterBtn exists");

  const enOverview = TRANSLATIONS.en.auth.overview;
  assert.ok(enOverview, "EN overview translations exist");
  assert.match(enOverview.stepBadge, /3 of 3/, "EN overview badge reflects step 3 of 3");
  assert.ok(enOverview.title, "EN overview title exists");
  assert.ok(enOverview.subtitle, "EN overview subtitle exists");
  assert.ok(enOverview.cards.strategy.title, "EN overview strategy title exists");
  assert.ok(enOverview.cards.execution.title, "EN overview execution title exists");
  assert.ok(enOverview.cards.workflow.title, "EN overview workflow title exists");
  assert.ok(enOverview.enterBtn, "EN overview enterBtn exists");
});

test("publicUser includes onboardingRole and onboardingGoal", () => {
  const dummyUser = {
    id: "usr_test123",
    fullName: "Cəsur Ələmanov",
    username: "cesur",
    email: "cesur@example.com",
    avatarUrl: null,
    emailVerifiedAt: "2026-09-08T00:00:00.000Z",
    onboardingFocus: "Strategiya qurmaq",
    onboardingRole: "Marketinq",
    onboardingGoal: "Strategiya qurmaq",
    onboardingCompletedAt: "2026-09-08T00:00:00.000Z",
    status: "active",
    settings: {
      industry: "Marketinq",
      personalIntelligence: true,
    },
  };

  const formatted = publicUser(dummyUser);
  assert.equal(formatted.onboardingRole, "Marketinq");
  assert.equal(formatted.onboardingGoal, "Strategiya qurmaq");
  assert.equal(formatted.onboardingCompleted, true);
  assert.equal(formatted.settings.industry, "Marketinq");
  assert.equal(formatted.settings.personalIntelligence, true);
});

test("public/auth.js complies with safe DOM manipulation (Rule 4), wide layout, and Step 3 overview", async () => {
  const authJs = await fs.readFile(path.join(process.cwd(), "public/auth.js"), "utf8");

  // Verify shell builds DOM safely with step badge and top bar
  assert.ok(authJs.includes("auth-top-bar"), "auth.js defines auth-top-bar");
  assert.ok(authJs.includes("data-theme-toggle"), "auth.js defines theme switcher");
  assert.ok(authJs.includes("auth-step-badge"), "auth.js defines auth-step-badge");
  assert.ok(authJs.includes("auth-ambient-glow"), "auth.js defines auth-ambient-glow");
  assert.ok(authJs.includes("auth-container-wide"), "auth.js supports wide container in shell");

  // Verify renderOnboarding handles multi-column grids, continue, and skip
  assert.ok(authJs.includes("onboarding-form"), "auth.js defines onboarding-form");
  assert.ok(authJs.includes("onboarding-grid-roles"), "auth.js defines onboarding-grid-roles");
  assert.ok(authJs.includes("onboarding-grid-goals"), "auth.js defines onboarding-grid-goals");
  assert.ok(authJs.includes("onboarding-card"), "auth.js defines onboarding-card");
  assert.ok(authJs.includes("onboarding-card-check"), "auth.js defines onboarding-card-check indicator");
  assert.ok(authJs.includes("auth-skip-btn"), "auth.js defines auth-skip-btn");
  assert.ok(authJs.includes("renderWorkspaceOverview"), "auth.js transitions to renderWorkspaceOverview");

  // Verify Step 3 Workspace Overview
  assert.ok(authJs.includes("onboarding-overview-container"), "auth.js defines onboarding-overview-container");
  assert.ok(authJs.includes("onboarding-overview-grid"), "auth.js defines onboarding-overview-grid");
  assert.ok(authJs.includes("onboarding-overview-card"), "auth.js defines onboarding-overview-card");
  assert.ok(authJs.includes("onboarding-enter-btn"), "auth.js defines onboarding-enter-btn");

  // Verify Google OAuth logic is intact
  assert.ok(authJs.includes("handleGoogleCredential"), "Google credential handler is preserved");
  assert.ok(authJs.includes("googleButtonOptions"), "Google button options are preserved");
  assert.ok(authJs.includes("helmer:theme-change"), "Theme change listener for Google button is preserved");

  // Verify no raw dynamic innerHTML injections (Rule 4)
  assert.ok(!authJs.includes("innerHTML = `\n    <section class=\"auth-story\""), "Old raw split HTML shell is removed");
  assert.ok(!authJs.includes("<h1>${escapeHtml(title)}</h1>"), "Unsafe string templating in shell is eliminated");
});

test("public/style.css defines unified Slate Dark / Clean Light styles, wide grid layout, and Step 3 overview", async () => {
  const styleCss = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Cohesive layout & wide container
  assert.ok(styleCss.includes(".auth-layout {"), "CSS defines .auth-layout");
  assert.ok(styleCss.includes('[data-theme="dark"] .auth-layout'), "CSS defines dark mode .auth-layout");
  assert.ok(styleCss.includes("background: #020617;"), "Dark mode canvas uses Slate 950 (#020617)");
  assert.ok(styleCss.includes(".auth-container-wide"), "CSS defines .auth-container-wide");

  // Ambient glow
  assert.ok(styleCss.includes(".auth-ambient-glow"), "CSS defines .auth-ambient-glow");
  assert.ok(styleCss.includes('[data-theme="dark"] .auth-ambient-glow'), "Dark mode defines ambient glow");

  // Glass card and step badge
  assert.ok(styleCss.includes(".auth-card {"), "CSS defines .auth-card");
  assert.ok(styleCss.includes('[data-theme="dark"] .auth-card'), "Dark mode defines glass card");
  assert.ok(styleCss.includes("rgba(15, 23, 42, 0.75)"), "Dark card uses Slate 900 translucent glass");
  assert.ok(styleCss.includes(".auth-step-badge"), "CSS defines .auth-step-badge");

  // Onboarding controls and multi-column grid
  assert.ok(styleCss.includes(".onboarding-form"), "CSS defines .onboarding-form");
  assert.ok(styleCss.includes(".onboarding-grid-roles"), "CSS defines .onboarding-grid-roles");
  assert.ok(styleCss.includes(".onboarding-grid-goals"), "CSS defines .onboarding-grid-goals");
  assert.ok(styleCss.includes(".onboarding-card"), "CSS defines .onboarding-card");
  assert.ok(styleCss.includes(".onboarding-card-inner"), "CSS defines .onboarding-card-inner");
  assert.ok(styleCss.includes(".onboarding-card-check"), "CSS defines .onboarding-card-check");
  assert.ok(styleCss.includes(".auth-skip-btn"), "CSS defines .auth-skip-btn");

  // Step 3 Overview styles
  assert.ok(styleCss.includes(".onboarding-overview-container"), "CSS defines .onboarding-overview-container");
  assert.ok(styleCss.includes(".onboarding-overview-grid"), "CSS defines .onboarding-overview-grid");
  assert.ok(styleCss.includes(".onboarding-overview-card"), "CSS defines .onboarding-overview-card");
  assert.ok(styleCss.includes(".onboarding-overview-icon"), "CSS defines .onboarding-overview-icon");
  assert.ok(styleCss.includes(".onboarding-enter-btn"), "CSS defines .onboarding-enter-btn");
  assert.ok(styleCss.includes('[data-theme="dark"] .onboarding-overview-card'), "Dark mode defines overview card");

  // Top bar and utilities
  assert.ok(styleCss.includes(".auth-top-bar"), "CSS defines .auth-top-bar");
  assert.ok(styleCss.includes(".auth-util-btn"), "CSS defines .auth-util-btn");
  assert.ok(styleCss.includes(".auth-footer"), "CSS defines .auth-footer");

  // Primary button contrast parity
  assert.match(styleCss, /\.auth-submit\s*\{[^}]*background:\s*#0b1f3a;/, "Light mode .auth-submit has navy blue #0b1f3a");
  assert.ok(styleCss.includes('[data-theme="dark"] .auth-submit'), "Dark mode .auth-submit rule exists");
});
