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
  assert.ok(tokensCss.includes("--bg-canvas: #111213;"));
  assert.ok(tokensCss.includes("--bg-rail: #191a1c;"));
  assert.ok(tokensCss.includes("--bg-sidebar: #18191b;"));
  assert.ok(tokensCss.includes("--bg-elevated: #202123;"));
  assert.ok(tokensCss.includes("--text-primary: #e6e7e9;"));
  // Theme adaptation must preserve the existing brand fill.
  assert.ok(tokensCss.includes("--accent: #4f6ee8;"));
});

test("index.html includes FOUC prevention and rail theme toggle button", async () => {
  const indexHtml = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");
  
  assert.ok(indexHtml.includes("marketify_theme"));
  assert.ok(indexHtml.includes("railThemeToggleButton"));
  assert.ok(indexHtml.includes("theme-icon-sun"));
  assert.ok(indexHtml.includes("theme-icon-moon"));
});

test("home.html includes FOUC prevention and header theme toggle button", async () => {
  const homeHtml = await fs.readFile(path.join(process.cwd(), "public/home.html"), "utf8");
  
  assert.ok(homeHtml.includes("marketify_theme"));
  assert.ok(homeHtml.includes("homeThemeToggle"));
  assert.ok(homeHtml.includes("theme-icon-sun"));
  assert.ok(homeHtml.includes("theme-icon-moon"));
});

test("theme styling retains navigation controls without the personalization appearance card", async () => {
  const styleCss = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  const appScript = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  
  assert.doesNotMatch(styleCss, /\.settings-theme-selector|\.theme-choice-card/);
  assert.doesNotMatch(appScript, /theme-choice-card|Görünüş teması/);
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

test("home.css includes home theme toggle styles", async () => {
  const homeCss = await fs.readFile(path.join(process.cwd(), "public/home.css"), "utf8");
  
  assert.ok(homeCss.includes(".theme-toggle-btn"));
  assert.ok(homeCss.includes("[data-theme=\"dark\"] .button-dark"));
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
  const document = {
    documentElement: { dataset: {} }, body: {}, readyState,
    querySelector: () => meta,
    querySelectorAll: selector => selector === '[data-theme-toggle]' ? controls : choices,
    addEventListener: (name, callback) => { listeners[name] = callback; },
  };
  const meta = { content: '#ffffff' };
  const window = {
    addEventListener: (name, callback) => { windowListeners[name] = callback; },
    dispatchEvent: event => events.push(event),
  };
  const storage = {
    getItem(key) { assert.equal(key, 'marketify_theme'); if (blocked) throw Error('blocked'); return saved; },
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
      attrs,
    };
    (theme ? choices : controls).push(node);
    return node;
  }
  return {
    document, meta, writes, events, control,
    start: () => listeners.DOMContentLoaded?.(),
    click: node => listeners.click({ target: { closest: () => node } }),
    insert: node => observer([{ addedNodes: [node] }]),
    storage: (key, newValue) => windowListeners.storage({ key, newValue }),
  };
}

test('first paint defaults to Light, restores only a valid Dark preference, and never overwrites storage at startup', () => {
  for (const [saved, expected] of [[null, 'light'], ['invalid', 'light'], ['light', 'light'], ['dark', 'dark']]) {
    const h = themeHarness({ saved });
    assert.equal(h.document.documentElement.dataset.theme, expected);
    assert.equal(h.meta.content, expected === 'dark' ? '#111213' : '#ffffff');
    assert.equal(h.writes.length, 0);
  }
});

test('theme switch supports nested icon clicks, saves both choices and updates accessible state', () => {
  const h = themeHarness();
  const toggle = h.control();
  h.start();
  assert.equal(toggle.attrs['aria-pressed'], 'false');
  h.click(toggle);
  assert.equal(h.document.documentElement.dataset.theme, 'dark');
  assert.equal(toggle.attrs['aria-label'], 'Light Mode-a keç');
  assert.equal(toggle.dataset.tooltip, 'Light Mode-a keç');
  assert.equal(toggle.attrs['aria-pressed'], 'true');
  h.click(toggle);
  assert.equal(h.document.documentElement.dataset.theme, 'light');
  assert.equal(h.meta.content, '#ffffff');
  assert.deepEqual(h.writes, [['marketify_theme', 'dark'], ['marketify_theme', 'light']]);
  assert.equal(h.events.at(-1).detail.theme, 'light');
});

test('blocked storage does not prevent rendering or switching themes', () => {
  const h = themeHarness({ blocked: true });
  h.start();
  h.click(h.control());
  assert.equal(h.document.documentElement.dataset.theme, 'dark');
  assert.equal(h.writes.length, 0);
});

test('newly rendered theme controls inherit the current theme without rerendering the page', () => {
  const h = themeHarness({ saved: 'dark', readyState: 'complete' });
  const light = h.control('light');
  const dark = h.control('dark');
  h.insert(dark);
  assert.equal(dark.attrs['aria-pressed'], 'true');
  assert.equal(light.attrs['aria-pressed'], 'false');
  h.click(light);
  assert.equal(light.attrs['aria-pressed'], 'true');
  assert.equal(dark.attrs['aria-pressed'], 'false');
  dark.disabled = true;
  h.click(dark);
  assert.equal(h.document.documentElement.dataset.theme, 'light');
});

test('tabs synchronize theme changes and reset to Light when the preference is removed', () => {
  const h = themeHarness();
  const toggle = h.control();
  h.start();
  h.storage('unrelated_key', 'dark');
  assert.equal(h.document.documentElement.dataset.theme, 'light');
  h.storage('marketify_theme', 'dark');
  assert.equal(toggle.attrs['aria-pressed'], 'true');
  h.storage('marketify_theme', null);
  assert.equal(toggle.attrs['aria-pressed'], 'false');
  h.storage(null, null);
  assert.equal(h.document.documentElement.dataset.theme, 'light');
  assert.equal(h.writes.length, 0);
});

test('all entry points restore the theme synchronously before CSS and load shared controls', async () => {
  for (const file of ['index.html', 'home.html', 'index_admin.html']) {
    const html = await fs.readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
    const script = html.match(/<script[^>]+src="\/theme\.js[^>]+>/)?.[0];
    assert.ok(script, file);
    assert.doesNotMatch(script, /\b(?:async|defer|module)\b/);
    assert.ok(html.indexOf(script) < html.indexOf('rel="stylesheet"'), file);
    assert.match(html, /href="\/theme\.css/);
    assert.match(html, /data-theme-toggle/);
  }
});

test('all compatibility tokens are dark-only and every referenced compatibility token is defined', async () => {
  const light = themeTokens.slice(0, themeTokens.indexOf(':root[data-theme="dark"]'));
  assert.doesNotMatch(light.replace(/\/\*[\s\S]*?\*\//g, ''), /--theme-[\w-]+\s*:/);
  const defined = new Set([...themeTokens.matchAll(/(--theme-[\w-]+)\s*:/g)].map(match => match[1]));
  for (const file of ['style.css', 'home.css', 'admin.css', 'theme.css']) {
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
