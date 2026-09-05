import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

test("tokens.css defines both light :root and dark [data-theme=\"dark\"] tokens", async () => {
  const tokensCss = await fs.readFile(path.join(process.cwd(), "public/tokens.css"), "utf8");
  
  // Verify light root tokens exist
  assert.ok(tokensCss.includes(":root {"));
  assert.ok(tokensCss.includes("--bg-canvas: #f8f9fb;"));
  assert.ok(tokensCss.includes("--bg-rail: #f1f3f6;"));
  assert.ok(tokensCss.includes("--bg-sidebar: #f5f6f8;"));
  assert.ok(tokensCss.includes("--bg-elevated: #ffffff;"));
  assert.ok(tokensCss.includes("--text-primary: rgba(16, 20, 30, 0.94);"));

  // Verify dark tokens exist
  assert.ok(tokensCss.includes("[data-theme=\"dark\"]"));
  assert.ok(tokensCss.includes("--bg-canvas: #000000;"));
  assert.ok(tokensCss.includes("--bg-rail: #0f172a;"));
  assert.ok(tokensCss.includes("--bg-sidebar: #0f172a;"));
  assert.ok(tokensCss.includes("--bg-elevated: #0f172a;"));
  assert.ok(tokensCss.includes("--bg-soft: #1e293b;"));
  assert.ok(tokensCss.includes("--text-primary: #f1f5f9;"));
  assert.ok(tokensCss.includes("--text-secondary: #94a3b8;"));
  // Theme adaptation must preserve the existing brand fill.
  assert.ok(tokensCss.includes("--accent: #4f6ee8;"));
});

test("index.html includes rail theme toggle button and helmer_theme storage key", async () => {
  const indexHtml = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");
  
  assert.ok(indexHtml.includes("helmer_theme"));
  assert.ok(indexHtml.includes("railThemeToggleButton"));
  assert.ok(indexHtml.includes("data-theme-toggle"));
});

test("style.css includes dark scrollbar styles with slate-900 track and slate-700 thumb", async () => {
  const styleCss = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  assert.ok(styleCss.includes("#0f172a"));
  assert.ok(styleCss.includes("#334155"));
  assert.ok(styleCss.includes("scrollbar-color"));
});

test("theme styling supports toggle controls and components while retaining design token compatibility fallbacks", async () => {
  const styleCss = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  
  assert.ok(styleCss.includes(".rail-theme-toggle"));
  // Components consume inherited theme tokens, including nodes rendered later.
  for (const component of ["sidebar", "ask-composer", "saved-card", "planner-task-card", "settings-panel", "legal-modal"]) {
    assert.ok(styleCss.includes(`.${component}`));
  }
  assert.match(styleCss, /--theme-surface/);
  assert.match(styleCss, /--theme-border/);
  assert.match(styleCss, /--strategy-paper: var\(--theme-surface, #fafafa\)/);
  assert.match(styleCss, /--strategy-ink: var\(--theme-ink, #18181b\)/);
});

test("dark mode styles primary action buttons in high-contrast white with dark text and icons", async () => {
  const styleCss = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  
  assert.ok(styleCss.includes('[data-theme="dark"] .archive-new-btn'));
  assert.ok(styleCss.includes('[data-theme="dark"] .primary-button'));
  assert.ok(styleCss.includes('[data-theme="dark"] .ask-submit'));
  assert.ok(styleCss.includes('[data-theme="dark"] .refine-submit'));
  assert.ok(styleCss.includes('[data-theme="dark"] .auth-submit'));
  assert.ok(styleCss.includes('[data-theme="dark"] .planner-submit-btn'));
  assert.ok(styleCss.includes("background: #ffffff;"));
  assert.ok(styleCss.includes("color: #0b0f17;"));
});

test("dark mode styles rail and settings toggles with high contrast white active tracks and dark thumbs", async () => {
  const styleCss = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  
  assert.ok(styleCss.includes('[data-theme="dark"] body[data-mode="ask"] .rail-toggle-track'));
  assert.ok(styleCss.includes('[data-theme="dark"] body[data-mode="ask"] .rail-toggle-thumb'));
  assert.ok(styleCss.includes('[data-theme="dark"] .settings-toggle.is-active'));
  assert.ok(styleCss.includes('[data-theme="dark"] .rail-theme-toggle'));
});

test("dark mode styles sidebar with pure black background matching railbar", async () => {
  const styleCss = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  
  assert.ok(styleCss.includes('[data-theme="dark"] .sidebar'));
  assert.ok(styleCss.includes('background: #000000;'));
});

test("dark mode styles Strategy Copilot panel with pure black background", async () => {
  const styleCss = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  
  assert.ok(styleCss.includes('[data-theme="dark"] .strategy-ask-panel'));
  assert.ok(styleCss.includes('[data-theme="dark"] .strategy-ask-header'));
  assert.ok(styleCss.includes('[data-theme="dark"] .strategy-ask-body'));
  assert.ok(styleCss.includes('[data-theme="dark"] .strategy-ask-footer'));
});

test("dark mode styles Usage and Limits view with obsidian surfaces and high-contrast typography", async () => {
  const styleCss = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  
  assert.ok(styleCss.includes('[data-theme="dark"] .limits-view'));
  assert.ok(styleCss.includes('[data-theme="dark"] .limits-mode-card'));
  assert.ok(styleCss.includes('[data-theme="dark"] .limits-chart-card'));
  assert.ok(styleCss.includes('[data-theme="dark"] .limits-faq-card'));
  assert.ok(styleCss.includes('[data-theme="dark"] .limits-segmented-control'));
  assert.ok(styleCss.includes('[data-theme="dark"] .limits-segment-btn.is-active'));
  assert.ok(styleCss.includes('[data-theme="dark"] .limits-mode-icon-box'));
  assert.ok(styleCss.includes('[data-theme="dark"] .build-icon-box'));
  assert.ok(styleCss.includes('[data-theme="dark"] .ask-icon-box'));
  assert.ok(styleCss.includes('[data-theme="dark"] .limits-empty-icon-wrap'));
});

const themeScript = await fs.readFile(new URL('../public/theme.js', import.meta.url), 'utf8');
const themeTokens = await fs.readFile(new URL('../public/tokens.css', import.meta.url), 'utf8');

function themeHarness({ saved, blocked = false, readyState = 'loading' } = {}) {
  const listeners = {};
  const windowListeners = {};
  const writes = [];
  const events = [];
  const controls = [];
  const choices = [];
  let observer;
  const classes = new Set();
  const document = {
    documentElement: {
      dataset: {},
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        toggle: (c, v) => (v ? classes.add(c) : classes.delete(c)),
        contains: (c) => classes.has(c),
      },
    },
    body: {},
    readyState,
    querySelector: () => meta,
    querySelectorAll: selector => selector === '[data-theme-toggle]' ? controls : choices,
    addEventListener: (name, callback) => { listeners[name] = callback; },
  };
  const meta = { content: '#ffffff' };
  const window = {
    addEventListener: (name, callback) => { windowListeners[name] = callback; },
    dispatchEvent: event => events.push(event),
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  };
  const storage = {
    getItem(key) { assert.equal(key, 'helmer_theme'); if (blocked) throw Error('blocked'); return saved; },
    setItem(key, value) { if (blocked) throw Error('blocked'); writes.push([key, value]); },
  };
  vm.runInNewContext(themeScript, {
    document, window, localStorage: storage,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    MutationObserver: class { constructor(callback) { observer = callback; } observe() {} },
  });
  function control(theme) {
    const attrs = {};
    const node = {
      dataset: theme ? { themeChoice: theme } : {}, disabled: false, nodeType: 1,
      setAttribute: (name, value) => { attrs[name] = value; },
      hasAttribute: name => name === 'data-tooltip',
      matches: () => true, querySelector: () => null,
      classList: { add: () => {}, remove: () => {} },
      attrs,
    };
    (theme ? choices : controls).push(node);
    return node;
  }
  return {
    document, meta, writes, events, control,
    start: () => listeners.DOMContentLoaded?.(),
    click: node => listeners.click?.({ target: { closest: () => node } }),
    insert: node => observer?.([{ addedNodes: [node] }]),
    storage: (key, newValue) => windowListeners.storage?.({ key, newValue }),
  };
}

test('first paint defaults to Light, restores valid Dark preference, and prevents FOUC with .dark class', () => {
  for (const [saved, expected] of [[null, 'light'], ['invalid', 'light'], ['light', 'light'], ['dark', 'dark']]) {
    const h = themeHarness({ saved });
    assert.equal(h.document.documentElement.dataset.theme, expected);
    if (expected === 'dark') {
      assert.equal(h.document.documentElement.classList.contains('dark'), true);
      assert.equal(h.meta.content, '#000000');
    } else {
      assert.equal(h.document.documentElement.classList.contains('dark'), false);
      assert.equal(h.meta.content, '#ffffff');
    }
  }
});

test('theme switch toggles between light and dark, persists choice, and updates accessibility attributes', () => {
  const h = themeHarness();
  const toggle = h.control();
  h.start();
  assert.equal(toggle.attrs['aria-pressed'], 'false');
  h.click(toggle);
  assert.equal(h.document.documentElement.dataset.theme, 'dark');
  assert.equal(h.document.documentElement.classList.contains('dark'), true);
  assert.equal(toggle.attrs['aria-label'], 'Light Mode-a keç');
  assert.equal(toggle.attrs['aria-pressed'], 'true');
  assert.equal(h.meta.content, '#000000');
  h.click(toggle);
  assert.equal(h.document.documentElement.dataset.theme, 'light');
  assert.equal(h.document.documentElement.classList.contains('dark'), false);
  assert.equal(h.meta.content, '#ffffff');
  assert.deepEqual(h.writes, [['helmer_theme', 'dark'], ['helmer_theme', 'light']]);
  assert.equal(h.events.at(-1).detail.theme, 'light');
});

test('cross-tab storage event updates theme', () => {
  const h = themeHarness();
  const toggle = h.control();
  h.start();
  assert.equal(h.document.documentElement.dataset.theme, 'light');
  h.storage('helmer_theme', 'dark');
  assert.equal(h.document.documentElement.dataset.theme, 'dark');
  assert.equal(toggle.attrs['aria-pressed'], 'true');
  h.storage('helmer_theme', 'light');
  assert.equal(h.document.documentElement.dataset.theme, 'light');
  assert.equal(toggle.attrs['aria-pressed'], 'false');
});

test('all entry points load theme.js synchronously before CSS', async () => {
  for (const file of ['index.html', 'index_admin.html']) {
    const html = await fs.readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
    const script = html.match(/<script[^>]+src="\/theme\.js[^>]+>/)?.[0];
    assert.ok(script, file);
    assert.doesNotMatch(script, /\b(?:async|defer|module)\b/);
    assert.ok(html.indexOf(script) < html.indexOf('rel="stylesheet"'), file);
  }
});

test('all compatibility tokens are dark-only and every referenced compatibility token is defined', async () => {
  const light = themeTokens.slice(0, themeTokens.indexOf(':root[data-theme="dark"]'));
  assert.doesNotMatch(light.replace(/\/\*[\s\S]*?\*\//g, ''), /--theme-[\w-]+\s*:/);
  const defined = new Set([...themeTokens.matchAll(/(--theme-[\w-]+)\s*:/g)].map(match => match[1]));
  for (const file of ['style.css', 'admin.css', 'theme.css']) {
    const css = await fs.readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
    for (const match of css.matchAll(/var\((--theme-[\w-]+)/g)) assert.ok(defined.has(match[1]), `${file}: ${match[1]}`);
    assert.doesNotMatch(css, /filter:\s*invert\(/);
  }
});

test('dark text and semantic inks meet 4.5:1 contrast across the main dark surfaces', () => {
  const value = name => themeTokens.match(new RegExp(`${name}: (#[a-f0-9]{6});`, 'g')).at(-1).match(/#[a-f0-9]{6}/)[0];
  const luminance = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  for (const ink of ['--text-primary', '--text-secondary', '--text-tertiary', '--theme-blue-ink', '--theme-purple-ink', '--theme-success-ink', '--theme-warning-ink', '--theme-danger-ink']) {
    for (const surface of ['--bg-canvas', '--bg-elevated', '--bg-soft', '--theme-surface-muted']) {
      const ratio = (luminance(value(ink)) + .05) / (luminance(value(surface)) + .05);
      assert.ok(ratio >= 4.5, `${ink} on ${surface}: ${ratio.toFixed(2)}`);
    }
  }
});
