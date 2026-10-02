import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("script.js defines unified minimalist SVG icons for all desktop context options", async () => {
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Verify all 4 context options have standard Lucide SVG icons (16x16)
  // 1. Fayl əlavə et (Paperclip)
  assert.ok(
    js.includes("m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"),
    "Paperclip SVG is used for Attach file"
  );

  // 2. Strategiyalarım (Compass)
  assert.ok(
    js.includes("<circle cx=\"12\" cy=\"12\" r=\"10\"/>") && js.includes("16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"),
    "Compass SVG is used for My Strategies"
  );

  // 3. Planlaşdırılanlar (CheckSquare)
  assert.ok(
    js.includes("m9 11 3 3L22 4") && js.includes("M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"),
    "CheckSquare SVG is used for Planner Tasks"
  );

  // 4. Hazır sual (MessageSquareText)
  assert.ok(
    js.includes("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z") && js.includes("M13 8H7"),
    "MessageSquareText SVG is used for Preset Prompts"
  );

  // Verify icon size standard (width 16, height 16)
  assert.ok(js.includes('width="16" height="16"'), "Icons use 16x16 standard");
});

test("script.js restricts chevrons to submenu triggers and omits chevron on direct file upload", async () => {
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // File upload is a direct trigger, should NOT append ask-context-menu-chevron
  const fileOptionSection = js.substring(
    js.indexOf("ask-context-menu-option-file"),
    js.indexOf("addSubmenuOption")
  );
  assert.ok(
    !fileOptionSection.includes("ask-context-menu-chevron"),
    "File option does not have chevron indicator"
  );

  // Submenu options have delicate chevron indicator
  assert.ok(
    js.includes('chevron.innerHTML = \'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>\''),
    "Submenu options use delicate 14x14 right chevron SVG"
  );

  // Submenu back buttons use delicate 14x14 left chevron SVG
  assert.ok(
    js.includes('back.innerHTML = \'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>\''),
    "Back button uses delicate 14x14 left chevron SVG"
  );
});

test("script.js implements Escape key and outside pointerdown dismissal", async () => {
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Both Build and Ask handlers implement closeContextMenuOnPointer and closeContextMenuOnKeyDown
  assert.ok(js.includes("closeContextMenuOnKeyDown"), "Ask menu implements Escape key listener");
  assert.ok(js.includes("closeBuildContextMenuOnKeyDown"), "Build menu implements Escape key listener");
  assert.ok(js.includes('event.key === "Escape"'), "Escape key check is performed");
  assert.ok(js.includes("closeContextMenuOnPointer"), "Ask menu implements pointerdown dismissal");
  assert.ok(js.includes("closeBuildContextMenuOnPointer"), "Build menu implements pointerdown dismissal");
});

test("style.css implements Linear/Raycast premium surface, border, and elevation", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Surface and glassmorphism
  assert.ok(css.includes(".ask-context-popover"), "ask-context-popover is defined");
  assert.ok(css.includes("backdrop-filter: blur(16px)"), "popover uses backdrop blur");
  assert.ok(css.includes("border-radius: 16px"), "popover uses rounded-2xl (16px)");
  assert.ok(css.includes("bottom: calc(100% + 8px)"), "popover is neatly positioned above trigger with 8px margin");
  assert.ok(css.includes("left: 0"), "popover aligns with trigger start (left: 0)");

  // Animation
  assert.ok(css.includes("@keyframes ask-context-popover-in"), "popover entry keyframes defined");
  assert.ok(css.includes("animation: ask-context-popover-in 100ms"), "micro-animation is applied with 100ms duration");

  // Category heading
  assert.ok(css.includes(".ask-context-menu-heading"), "category heading is defined");
  assert.ok(css.includes("text-transform: uppercase"), "heading is uppercase");
  assert.ok(css.includes("letter-spacing: 0.06em"), "heading has tracking-wider letter spacing");

  // Compact item dimensions & hover
  assert.ok(css.includes(".ask-context-menu-option"), "menu option is defined");
  assert.ok(css.includes("border-radius: 8px"), "options use rounded-lg (8px)");
  assert.ok(css.includes(".ask-context-menu-option:hover"), "hover state is styled");

  // Monochromatic icons without colored background pills
  assert.ok(css.includes(".ask-context-menu-option-icon"), "icon wrapper is defined");
  const iconRule = css.match(/\.ask-context-menu-option-icon\s*\{[^}]*\}/)?.[0] || "";
  assert.ok(iconRule, "icon rule exists");
  assert.ok(!iconRule.includes("background"), "icon wrapper has no background pill");

  // Dark mode parity
  assert.ok(css.includes(':root[data-theme="dark"] .ask-context-popover'), "dark mode popover surface is styled");
  assert.ok(css.includes(':root[data-theme="dark"] .ask-context-menu-option:hover'), "dark mode hover state is styled");
  assert.ok(css.includes(':root[data-theme="dark"] .ask-context-menu-heading'), "dark mode heading is styled");
});

test("mobile isolation is strictly preserved", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Mobile popover is suppressed
  assert.ok(
    css.includes(".ask-context-menu > .ask-context-popover"),
    "desktop popover is targeted in mobile suppression rule"
  );

  // Mobile breakpoint opens bottom sheet
  assert.ok(
    js.includes("window.innerWidth <= 767"),
    "window width check delegates mobile interaction to bottom sheet"
  );
  assert.ok(
    js.includes("openMobileContextSheet"),
    "openMobileContextSheet is preserved for mobile devices"
  );
});
