import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("style.css: mobile home gradient blooms upwards from under input bar and removes center gradient", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Mobile media query block exists
  assert.ok(css.includes("@media (max-width: 767px)"), "Mobile media query exists in style.css");

  // Gradient under input bar expanding upwards
  assert.ok(
    css.includes("radial-gradient(ellipse 135% 80% at 50% 100%"),
    "Mobile empty state has radial gradient at 50% 100% (under input bar expanding upwards)"
  );

  // Spreading animation on site load
  assert.ok(
    css.includes("@keyframes mobile-gradient-bloom"),
    "@keyframes mobile-gradient-bloom is defined for gradient spread animation"
  );
  assert.ok(
    css.includes("animation: mobile-gradient-bloom"),
    "mobile-gradient-bloom animation is applied to mobile empty gradient layer"
  );

  // Dark mode parity for mobile bottom gradient
  assert.ok(
    css.includes('[data-theme="dark"] .workspace-ask.is-empty::before') ||
    css.includes('[data-theme="dark"] .workspace-intake.is-empty::before'),
    "Dark mode mobile gradient on ::before is defined"
  );

  // Desktop gradients still exist outside mobile media query
  assert.ok(
    css.includes("radial-gradient(ellipse 72% 56% at 50% 48%"),
    "Desktop base styles preserve their original desktop center gradient"
  );
});

test("style.css: mobile CTA hides smoothly when user starts typing in input bar", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Smooth transition on .ask-intro
  assert.ok(
    css.includes(".ask-shell.is-empty .ask-intro"),
    ".ask-shell.is-empty .ask-intro is styled for mobile"
  );

  // Hiding rules
  assert.ok(
    css.includes(".ask-shell.is-empty.has-input .ask-intro"),
    ".ask-shell.is-empty.has-input .ask-intro rule exists"
  );
  assert.ok(
    css.includes(".ask-shell.is-empty:has(.ask-input:not(:placeholder-shown)) .ask-intro"),
    ":placeholder-shown fallback exists for typing detection"
  );
  assert.ok(
    css.includes("visibility: hidden"),
    "Hiding rule includes visibility: hidden"
  );
  assert.ok(
    css.includes("pointer-events: none"),
    "Hiding rule prevents pointer events when hidden"
  );
});

test("script.js: input events and initialization toggle has-input on shell in both Build and Ask modes", async () => {
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Build mode (renderIntake)
  assert.ok(
    js.includes('shell.classList.toggle("has-input", Boolean(textarea.value.trim()))'),
    "renderIntake toggles has-input on shell based on textarea.value"
  );

  // Ask mode (renderAsk)
  assert.ok(
    js.includes('shell.classList.toggle("has-input", Boolean(input.value.trim()))'),
    "renderAsk toggles has-input on shell based on input.value"
  );
});
