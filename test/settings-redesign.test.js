import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("Settings: script.js renders modern kicker, segmented tabs, and SVG chevrons", async () => {
  const script = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Kicker and modern header
  assert.ok(script.includes("settings-kicker"), "settings-kicker is rendered");
  assert.ok(script.includes("settings-view"), "settings-view wrapper is present");
  assert.ok(script.includes("settings-header"), "settings-header is present");

  // Segmented tabs with icons and accessibility attributes
  assert.ok(script.includes('tablist'), "tablist role is specified");
  assert.ok(script.includes('tab'), "tab role is specified");
  assert.ok(script.includes("settings-tab-icon"), "tab icon container is rendered");

  // Guest sync banner and guest security/legal views
  assert.ok(script.includes("guest-sync-banner"), "guest-sync-banner is rendered for non-authenticated users");
  assert.ok(script.includes("guest-sync-icon"), "guest-sync-icon is rendered");
  assert.ok(script.includes("experience-mode-grid"), "workspace mode options grid is rendered");
  assert.ok(script.includes("experience-mode-card"), "workspace mode option card is rendered");
  assert.ok(script.includes("settings-legal-list"), "legal list is rendered");
  assert.ok(script.includes("settings-legal-row"), "legal rows are rendered");

  // Standardized SVG chevrons (no text plus signs)
  assert.ok(script.includes("experience-chevron"), "SVG chevrons are used for accordions");
  assert.ok(!script.includes("experience-accordion-icon\">+"), "Text plus sign accordion icon has been eliminated");
});

test("Settings: style.css defines minimalist segmented controls, eliminates top gradient bar, and sets clean surfaces", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Segmented tabs & kicker
  assert.ok(css.includes(".settings-kicker {"), ".settings-kicker styling is defined");
  assert.ok(css.includes(".settings-tabs {"), ".settings-tabs container is defined");
  assert.ok(css.includes(".settings-tab {"), ".settings-tab is defined");
  assert.ok(css.includes(".settings-tab-icon {"), ".settings-tab-icon is defined");

  // Panel without archaic top gradient bar
  assert.ok(css.includes(".settings-panel {"), ".settings-panel is defined");
  assert.ok(css.includes(".settings-panel::before {\n  display: none;\n}"), "Top accent gradient bar is disabled");

  // Guest & feature card components
  assert.ok(css.includes(".guest-sync-banner {"), ".guest-sync-banner styling is defined");
  assert.ok(css.includes(".guest-sync-icon {"), ".guest-sync-icon styling is defined");
  assert.ok(css.includes(".experience-mode-options {"), ".experience-mode-options styling is defined");
  assert.ok(css.includes(".experience-mode-option.is-selected {"), ".experience-mode-option selected state is defined");
  assert.ok(css.includes(".settings-security-card {"), ".settings-security-card styling is defined");
  assert.ok(css.includes(".settings-legal-list {"), ".settings-legal-list styling is defined");
  assert.ok(css.includes(".settings-legal-card {"), ".settings-legal-card styling is defined");

  // Accordion smooth rotation
  assert.ok(css.includes(".experience-chevron {"), ".experience-chevron styling is defined");
  assert.ok(css.includes(".experience-accordion[open] .experience-chevron {"), "Accordion open rotation is defined");

  // Theme selector dropdown styling
  assert.ok(css.includes(".settings-theme-row"), ".settings-theme-row styling is defined");
  assert.ok(css.includes(".settings-theme-trigger"), ".settings-theme-trigger styling is defined");
  assert.ok(css.includes(".settings-theme-menu"), ".settings-theme-menu styling is defined");
});

test("Settings: Dark mode parity is fully implemented with high-contrast obsidian surfaces", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  assert.ok(css.includes('[data-theme="dark"] .settings-panel'), "Dark mode settings panel styling is defined");
  assert.ok(css.includes('[data-theme="dark"] .settings-tabs'), "Dark mode segmented tabs styling is defined");
  assert.ok(css.includes('[data-theme="dark"] .settings-tab.is-active'), "Dark mode active tab styling is defined");
  assert.ok(css.includes('[data-theme="dark"] .guest-sync-banner'), "Dark mode guest banner styling is defined");
  assert.ok(css.includes('[data-theme="dark"] .experience-preview-card'), "Dark mode experience preview is defined");
  assert.ok(css.includes('[data-theme="dark"] .settings-security-card'), "Dark mode security card is defined");
  assert.ok(css.includes('[data-theme="dark"] .settings-legal-card'), "Dark mode legal card is defined");
  assert.ok(css.includes('[data-theme="dark"] .experience-mode-option'), "Dark mode experience mode option is defined");
  assert.ok(css.includes('[data-theme="dark"] .settings-danger-zone'), "Dark mode danger zone styling is defined");
});

test("Settings: Profile Card is open by default with arrow on right, Theme is collapsed by default, Default Mode is open by default", async () => {
  const script = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Single Profile Card with arrow on the right side and open details by default
  assert.ok(script.includes('profileCard = document.createElement("details");'), "Profile card is an accordion details element");
  assert.ok(script.includes('profileCard.className = "account-profile-card experience-accordion";'), "Profile card has accordion classes");
  assert.ok(script.includes("profileCard.open = true;"), "Profile card is open by default (open = true)");
  assert.ok(script.includes("account-profile-summary"), "Summary contains profile header");
  assert.ok(script.includes("account-profile-avatar"), "Avatar initial is rendered in summary");
  assert.ok(script.includes("account-profile-name"), "User name is rendered in summary");
  assert.ok(script.includes("account-profile-role"), "Email / workspace role is rendered in summary");
  assert.ok(script.includes("experience-chevron"), "Chevron arrow is on the right side of the summary");
  assert.ok(script.includes("account-profile-body"), "Details body container exists inside profile card");

  // CSS rules for single profileCard accordion
  assert.ok(css.includes(".account-profile-summary {"), "CSS rules for account-profile-summary exist");
  assert.ok(css.includes(".account-profile-card .experience-accordion-icon {"), "CSS positions chevron arrow on the right");
  assert.ok(css.includes(".account-profile-body {"), "CSS rules for account-profile-body exist");

  // Appearance & Surface Tone is placed in Experience (Personalization) tab and collapsed by default
  assert.ok(
    script.includes('title: isEn ? "Appearance & Surface Tone" : "Vizual Görünüş və Mövzu"') &&
    script.includes("badgeNode: themeBadge,\n      isOpen: false,"),
    "Appearance & Surface Tone accordion is configured with isOpen: false"
  );
  assert.ok(
    script.includes("form.append(masterCard, modeAccordion, themeAccordion, toneAccordion);") &&
    script.includes("guestStack.append(masterCard, modeAccordion, themeAccordion, toneAccordion);"),
    "Theme studio accordion is integrated into Personalization (experience) tab for both auth and guest"
  );

  // Default Workspace Mode in Experience tab should be an accordion, open by default, and unique
  assert.ok(
    script.includes('title: isEn ? "Default Workspace Mode" : "İlkin İş Rejimi"') &&
    script.includes("badgeNode: modeBadge,\n      isOpen: true,"),
    "Default Workspace Mode accordion is configured with isOpen: true"
  );

  // Verify there is only one declaration of Default Workspace Mode accordion
  const occurrences = (script.match(/title:\s*isEn \? "Default Workspace Mode" : "İlkin İş Rejimi"/g) || []).length;
  assert.equal(occurrences, 1, "Exactly one Default Workspace Mode accordion is defined");

  // In Account tab: Profile Card -> Language selector (Storage diagnostics removed)
  const profileIndex = script.indexOf("panel.appendChild(profileCard);");
  const langIndex = script.indexOf("panel.appendChild(buildLanguageSelectorSection());");
  assert.ok(profileIndex !== -1 && langIndex !== -1, "Profile and Language components are appended in Account tab");
  assert.ok(profileIndex < langIndex, "Order in Account is: Profile Card -> Language selector");
  assert.ok(!script.includes("Workspace Storage & Telemetry"), "Workspace Storage & Telemetry is removed from Settings");
  assert.ok(!script.includes("detailsAccordion"), "No redundant separate details card is created");
  assert.ok(!script.includes("buildThemeSelectorSection"), "Duplicate theme dropdown card is removed");
});

test("Settings: Security tab has realistic protection descriptions, Legal has direct contact card, and mobile styles exist", async () => {
  const script = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Security tab has realistic/general descriptions (not overly ambitious enterprise claims)
  assert.ok(script.includes("Security & Data Protection"), "Security card uses realistic title");
  assert.ok(!script.includes("Enterprise Security & Protection Status"), "Eliminated exaggerated enterprise title");
  assert.ok(script.includes("Encrypted Connection"), "Uses clear Encrypted Connection tile");
  assert.ok(script.includes("Session & Account Safety"), "Uses clear Session & Account Safety tile");
  assert.ok(script.includes("Data Control"), "Uses clear Data Control tile");

  // Legal & Policy tab has direct contact card with requested email
  assert.ok(script.includes("settings-legal-contact-card"), "Contact card container is rendered");
  assert.ok(script.includes("mailto:helmerworkspace@googlegroups.com"), "Direct mailto link is present");
  assert.ok(script.includes("Əlaqə saxla"), "Button displays 'Əlaqə saxla'");
  assert.ok(!script.includes("bizimlə əlaqə saxlayın:"), "Colon has been eliminated from contact subtext");

  // CSS defines contact card and mobile responsiveness
  assert.ok(css.includes(".settings-legal-contact-card {"), "CSS defines .settings-legal-contact-card");
  assert.ok(css.includes(".legal-contact-email-btn {"), "CSS defines .legal-contact-email-btn");
  assert.ok(css.includes('[data-theme="dark"] .settings-legal-contact-card'), "Dark mode defines legal contact card");
});

test("Buttons: primary buttons use deep navy blue in light mode and white in dark mode", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Light mode primary button styles
  assert.match(css, /\.primary-button\s*\{[^}]*background:\s*#0b1f3a;/, "Light mode .primary-button has navy blue background #0b1f3a");
  assert.match(css, /\.primary-button:not\(:disabled\):hover\s*\{[^}]*background:\s*#132d52;/, ".primary-button hover has lighter navy blue #132d52");
  assert.match(css, /\.workspace-centered \.composer-submit\s*\{[^}]*background:\s*#0b1f3a;/, ".composer-submit has navy blue background");
  assert.match(css, /\.refine-submit\s*\{[^}]*background:\s*#0b1f3a;/, ".refine-submit has navy blue background");
  assert.match(css, /\.archive-new-btn\s*\{[^}]*background:\s*#0b1f3a;/, ".archive-new-btn has navy blue background");
  assert.match(css, /\.auth-submit\s*\{[^}]*background:\s*#0b1f3a;/, ".auth-submit has navy blue background");
  assert.match(css, /\.planner-submit-btn\s*\{[^}]*background:\s*#0b1f3a;/, ".planner-submit-btn has navy blue background");

  // Dark mode preservation
  assert.ok(css.includes('[data-theme="dark"] .primary-button'), "Dark mode .primary-button rule exists");
  assert.ok(css.includes("background: #ffffff;"), "Dark mode has white buttons");
  assert.ok(css.includes("color: #0b0f17;"), "Dark mode has dark text");
});

