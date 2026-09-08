import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("style.css: single panel navigation layout attaches sidebar to left boundary and hides navigation rail", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Sidebar attaches flush to left boundary (inset: 0 auto 0 0)
  assert.ok(
    css.includes("inset: 0 auto 0 0;"),
    ".sidebar must attach flush to left boundary (inset: 0 auto 0 0)"
  );
  assert.ok(
    css.includes("transform: translateX(-100%);"),
    ".sidebar must hide offscreen to left by default"
  );
  assert.ok(
    css.includes(".sidebar.is-open {\n  transform: translateX(0);"),
    ".sidebar.is-open must slide into view at x=0"
  );

  // Navigation rail is hidden when sidebar is open (no dual side-by-side vertical panels)
  assert.ok(
    css.includes("body.sidebar-open .navigation-rail {\n  transform: translateX(-100%);\n  opacity: 0;\n  visibility: hidden;"),
    "body.sidebar-open .navigation-rail must be hidden when sidebar is open"
  );

  // App main content margin adjusts to single sidebar width
  assert.ok(
    css.includes("body.sidebar-open .app-main {\n  margin-left: var(--sidebar-width);\n}"),
    "body.sidebar-open .app-main must offset by var(--sidebar-width)"
  );

  // Bottom docks center accurately relative to sidebar-width
  assert.ok(
    css.includes("body.sidebar-open .refinement-dock {\n  left: calc(var(--sidebar-width) + (100vw - var(--sidebar-width)) / 2);\n}"),
    "refinement dock centers accurately relative to sidebar-width"
  );
  assert.ok(
    css.includes("body.sidebar-open .archive-bottom-dock {\n  left: calc(var(--sidebar-width) + (100vw - var(--sidebar-width)) / 2);\n}"),
    "archive bottom dock centers accurately relative to sidebar-width"
  );
  assert.ok(
    css.includes("body.sidebar-open .planner-composer-card {\n  left: calc(50% + var(--sidebar-width) / 2);\n  width: min(760px, calc(100vw - var(--sidebar-width) - 64px));\n}"),
    "planner composer card centers accurately relative to sidebar-width"
  );
});

test("style.css: top section features clean pill segmented control and borderless flat rows", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Mode switch is a full pill capsule with rounded-full border-radius
  assert.ok(
    css.includes(".sidebar-mode-switch {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  width: 100%;\n  height: 36px;\n  padding: 3px;\n  margin-bottom: 12px;\n  border-radius: 9999px;"),
    ".sidebar-mode-switch is a full pill capsule (border-radius: 9999px)"
  );

  // New Strategy button is borderless and transparent by default
  assert.ok(
    css.includes(".new-strategy-button {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  height: 36px;\n  min-height: 36px;\n  padding: 0 10px;\n  border-radius: 8px;\n  background: transparent;\n  border: none;"),
    ".new-strategy-button is borderless and transparent by default"
  );

  // Nav item is borderless and transparent by default
  assert.ok(
    css.includes(".nav-item {\n  display: flex;\n  align-items: center;\n  width: 100%;\n  min-height: 36px;\n  height: 36px;\n  gap: 10px;\n  padding: 0 10px;\n  border-radius: 8px;\n  background: transparent;\n  border: none;"),
    ".nav-item is borderless and transparent by default"
  );

  // Hover state in dark mode uses soft bg-neutral-800/40
  assert.ok(
    css.includes("background: rgba(38, 38, 38, 0.4); /* bg-neutral-800/40 */"),
    "hover state uses soft bg-neutral-800/40 in dark mode"
  );

  // Nav counts are subtle, dark, minimal with tabular nums
  assert.ok(
    css.includes(".nav-count {\n  min-width: 17px;\n  height: 16px;\n  margin-left: auto;\n  padding: 0 5px;"),
    ".nav-count has minimal dimensions"
  );
  assert.ok(
    css.includes("font-variant-numeric: tabular-nums;"),
    ".nav-count uses tabular-nums"
  );
});

test("script.js and style.css: chat history uses pure typography, removes icon boxes, and provides hover delete action safely", async () => {
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Check renderRecentList inside script.js
  const recentFn = js.substring(
    js.indexOf("function renderRecentList()"),
    js.indexOf("function updateWorkspaceIdentity(")
  );

  // No icon element appended to chat items
  assert.ok(
    !recentFn.includes('item.append(icon, textWrap, deleteBtn);'),
    "Chat item must not append icon wrap"
  );
  assert.ok(
    recentFn.includes('item.append(textWrap, deleteBtn);'),
    "Chat item appends pure textWrap and deleteBtn"
  );

  // Rule 4 & 5 compliance: No raw innerHTML in recentList rendering
  assert.ok(
    !recentFn.includes('.innerHTML ='),
    "renderRecentList must not use raw innerHTML (strictly adheres to Rule 4)"
  );
  assert.ok(
    recentFn.includes('document.createElementNS("http://www.w3.org/2000/svg", "svg")'),
    "Delete SVG is created safely with createElementNS"
  );

  // CSS for recent-delete-btn: hidden by default, visible on hover/focus-within
  assert.ok(
    css.includes(".recent-item:hover .recent-delete-btn"),
    "Hovering recent-item displays recent-delete-btn"
  );
  assert.ok(
    css.includes(".recent-delete-btn:hover {\n  background: rgba(220, 38, 38, 0.1);\n  color: var(--danger, #dc2626);\n}"),
    "recent-delete-btn has soft red danger hover state"
  );
});

test("index.html and script.js: footer user profile block is preserved with avatar, name, status, and popover trigger", async () => {
  const html = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Footer structure in index.html
  assert.ok(html.includes('id="accountButton"'), "accountButton exists in index.html");
  assert.ok(html.includes('id="workspaceAvatar"'), "workspaceAvatar exists in accountButton");
  assert.ok(html.includes('id="workspaceName"'), "workspaceName exists in accountButton");
  assert.ok(html.includes('id="workspaceMeta"'), "workspaceMeta exists in accountButton");
  assert.ok(html.includes('class="account-chevron"'), "account-chevron exists in accountButton");

  // Popover triggering preserved in script.js
  assert.ok(
    js.includes("openUserProfileMenu(accountButton)"),
    "accountButton click triggers openUserProfileMenu"
  );
});

test("index.html and style.css: sidebar navigation icons use smooth rounded ~20px stroke style, pen nib, and search magnifier", async () => {
  const html = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");

  // Verify navigation elements exist
  assert.ok(html.includes('id="newStrategyButton"'), "newStrategyButton exists");
  assert.ok(html.includes('id="searchNav"'), "searchNav exists");
  assert.ok(html.includes('id="homeNav"'), "homeNav exists");
  assert.ok(html.includes('id="strategiesNav"'), "strategiesNav exists");
  assert.ok(html.includes('id="plannerNav"'), "plannerNav exists");
  assert.ok(html.includes('id="limitsNav"'), "limitsNav exists");
  assert.ok(html.includes('id="settingsNav"'), "settingsNav exists");

  // New Strategy / Chat uses slanted cut-nib pen icon
  assert.ok(
    html.includes('d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"'),
    "newStrategyButton uses slanted cut-nib pen icon"
  );
  // Search uses circular magnifier
  assert.ok(
    html.includes('<circle cx="11" cy="11" r="7.5"/>'),
    "searchNav uses circular search magnifier"
  );
  // Home uses smooth rounded home
  assert.ok(
    html.includes('d="M3.5 10.5 12 3l8.5 7.5v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"'),
    "homeNav uses smooth rounded home"
  );
  // Archive uses 4-quadrant rounded library icon from reference
  assert.ok(
    html.includes('<rect x="3" y="3" width="7.5" height="7.5" rx="2.5"/>'),
    "strategiesNav uses 4-quadrant rounded library icon"
  );
  // Planner uses smooth rounded calendar
  assert.ok(
    html.includes('rx="3.5"'),
    "plannerNav uses smooth rounded calendar"
  );
  // Usage uses smooth activity/spark line
  assert.ok(
    html.includes('d="M3 12h3.5l3-7 5 14 3-7H21"'),
    "limitsNav uses smooth activity/spark"
  );
  // Settings uses smooth rounded gear
  assert.ok(
    html.includes('<circle cx="12" cy="12" r="3"/>'),
    "settingsNav uses smooth rounded gear"
  );
  // Sidebar close uses clean rounded x
  assert.ok(
    html.includes('d="m18 6-12 12M6 6l12 12"'),
    "sidebarClose uses clean rounded X"
  );

  // CSS enforces 20px dimensions, 1.75 stroke-width, and smooth rounded caps
  assert.ok(css.includes(".nav-svg {\n  width: 20px;\n  height: 20px;\n  fill: none !important;\n  stroke: currentColor !important;\n  stroke-width: 1.75;"), "nav-svg dimensions are 20px and stroke-width is 1.75");
  assert.ok(
    css.includes("color: var(--text-tertiary, #64748b);"),
    "nav-item .nav-svg inactive state uses subtle slate"
  );
  assert.ok(
    css.includes(".nav-item.is-active .nav-svg {\n  opacity: 1;\n  color: var(--theme-blue-ink, var(--accent));\n}"),
    "nav-item.is-active .nav-svg is emphasized with accent color"
  );
  assert.ok(
    css.includes('[data-theme="dark"] .nav-item .nav-svg'),
    "dark mode styles exist for nav icons"
  );
});

test("Search modal, nav deduplication, and selection handlers are correct and functional", async () => {
  const html = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  const i18n = await fs.readFile(path.join(process.cwd(), "public/i18n.js"), "utf8");

  // In primary-nav, homeNav is before searchNav
  const homeNavIndex = html.indexOf('id="homeNav"');
  const searchNavIndex = html.indexOf('id="searchNav"');
  assert.ok(homeNavIndex !== -1 && searchNavIndex !== -1, "Both homeNav and searchNav exist");
  assert.ok(homeNavIndex < searchNavIndex, "homeNav comes before searchNav in primary navigation");

  // Search translations say 'Search' rather than 'Search chats'
  assert.ok(i18n.includes('searchChats: "Search",'), "EN searchChats is 'Search'");
  assert.ok(i18n.includes('searchPlaceholder: "Search...",'), "EN searchPlaceholder is 'Search...'");

  // In syncNav, searchLabel says Search
  assert.ok(js.includes('searchLabel.textContent = isEn ? "Search" : "Axtarış";'), "searchLabel displays Search");

  // Both Build and Ask modes hide newStrategyButton, keeping only Home (Başlanğıc / Chat)
  assert.ok(html.includes('id="newStrategyButton" type="button" style="display: none;"'), "newStrategyButton is hidden in HTML");
  assert.ok(js.includes('newStrategyButton.style.display = "none";'), "newStrategyButton is hidden in syncNav");

  // Search modal is mode-aware and prioritizes chat history in Ask mode
  assert.ok(js.includes('const isAsk = state.mode === "ask";'), "openSearchModal checks if state.mode is ask");
  assert.ok(js.includes('results.push(...chatMatches);'), "openSearchModal shows chat history for Ask mode");
  assert.ok(js.includes('results.push(...strategyMatches);'), "openSearchModal shows strategies for Build mode");

  // Search selection uses existing openSavedStrategy and openSavedChat handlers
  assert.ok(js.includes('openSavedStrategy(strat.id);'), "Search calls openSavedStrategy for strategies");
  assert.ok(js.includes('openSavedChat(chat.id);'), "Search calls openSavedChat for chats");
  assert.ok(!js.includes('loadSavedStrategy('), "Does not call undefined loadSavedStrategy");
  assert.ok(!js.includes('loadChat('), "Does not call undefined loadChat");
});

test("AI badge removed from Ask, collapsible history supported in Ask & Build, and mobile search uses bottom sheet format", async () => {
  const html = await fs.readFile(path.join(process.cwd(), "public/index.html"), "utf8");
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // AI badge removed from Ask button
  assert.ok(!html.includes('class="sidebar-mode-badge">AI<'), "AI badge is removed from sidebarAskModeButton");

  // Collapsible history in Ask & Build
  assert.ok(html.includes('id="recentCollapseToggle"'), "recentCollapseToggle exists in index.html");
  assert.ok(html.includes('id="recentSection"'), "recentSection exists in index.html");
  assert.ok(html.includes('class="recent-collapse-chevron"'), "recent-collapse-chevron exists in toggle button");
  assert.ok(css.includes(".recent-collapse-toggle {"), "recent-collapse-toggle is styled in CSS");
  assert.ok(css.includes(".recent-section.is-collapsed .recent-list {"), "recent-section.is-collapsed styles recent-list");
  assert.ok(css.includes("transform: rotate(-90deg);"), "chevron rotates when collapsed");
  assert.ok(js.includes('recentSection.classList.toggle("is-collapsed");'), "script.js toggles is-collapsed on recentSection");

  // Mobile search bottom sheet
  assert.ok(css.includes("/* Mobile Search Bottom Sheet */"), "Mobile search bottom sheet section exists in CSS");
  assert.ok(css.includes("animation: slideUpSearchSheet"), "Slide-up bottom sheet animation is defined");
  assert.ok(css.includes(".sidebar-search-handle {"), "sidebar-search-handle is styled");
  assert.ok(css.includes(".sidebar-search-close {"), "sidebar-search-close is styled");
  assert.ok(js.includes('element("div", "sidebar-search-handle")'), "script.js appends sidebar-search-handle to search card");
  assert.ok(js.includes('element("button", "sidebar-search-close")'), "script.js appends sidebar-search-close to search header");
});

