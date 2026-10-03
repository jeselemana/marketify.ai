import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";

test("artifacts.js: renders authentic official brand logos for Word, Excel, PowerPoint, and PDF", async () => {
  const artifactsSource = await fs.readFile(path.join(process.cwd(), "public/artifacts.js"), "utf8");
  const plugins = [
    { id: "word", name: "Word", icon: "document", description: "Create a Word document", status: "available" },
    { id: "excel", name: "Excel", icon: "spreadsheet", description: "Create an Excel workbook", status: "available" },
    { id: "powerpoint", name: "PowerPoint", icon: "presentation", description: "Create a PowerPoint deck", status: "available" },
    { id: "pdf", name: "PDF", icon: "pdf", description: "Create a PDF document", status: "available" },
  ];

  const dom = new JSDOM(
    '<html lang="en"><body><section class="ask-shell is-empty"><div id="composer"><textarea id="askInput"></textarea></div></section></body></html>',
    { url: "http://localhost", runScripts: "outside-only" }
  );

  dom.window.fetch = async () => ({ ok: true, json: async () => ({ plugins }) });
  dom.window.innerWidth = 1024;
  dom.window.eval(artifactsSource);

  let selection = [];
  const input = dom.window.document.querySelector("textarea");
  const body = dom.window.document.querySelector("#composer");

  dom.window.HelmerArtifacts.attachComposer({
    input,
    body,
    getSelection: () => selection,
    setSelection: (val) => { selection = val; },
  });

  await new Promise((resolve) => setImmediate(resolve));

  // Trigger @ popup on desktop main page
  input.value = "@";
  input.setSelectionRange(1, 1);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  const selector = dom.window.document.querySelector(".ask-plugin-selector");
  assert.ok(selector, "Plugin selector popup must exist");
  assert.equal(selector.classList.contains("is-downwards"), true, "Plugin selector must have is-downwards on desktop main page");

  const options = Array.from(dom.window.document.querySelectorAll(".ask-plugin-option"));
  assert.equal(options.length, 4, "Should show 4 plugin options");

  // Word option check
  const wordOpt = options.find((opt) => opt.textContent.includes("@Word"));
  assert.ok(wordOpt, "Word option must be present");
  const wordSvg = wordOpt.querySelector("svg");
  assert.ok(wordSvg, "Word must have an SVG logo");
  assert.ok(
    wordSvg.innerHTML.includes("#185abd") || wordSvg.innerHTML.includes("#41a5ee"),
    "Word logo must include Microsoft Word official blue colors"
  );
  assert.ok(wordSvg.innerHTML.includes("18.53 31"), "Word logo must include white W path");

  // Excel option check
  const excelOpt = options.find((opt) => opt.textContent.includes("@Excel"));
  assert.ok(excelOpt, "Excel option must be present");
  const excelSvg = excelOpt.querySelector("svg");
  assert.ok(excelSvg, "Excel must have an SVG logo");
  assert.ok(
    excelSvg.innerHTML.includes("#107c41") || excelSvg.innerHTML.includes("#0e6f3a") || excelSvg.innerHTML.includes("#21a366"),
    "Excel logo must include Microsoft Excel official green colors"
  );
  assert.ok(excelSvg.innerHTML.includes("6.75 31"), "Excel logo must include white X path");

  // PowerPoint option check
  const pptOpt = options.find((opt) => opt.textContent.includes("@PowerPoint"));
  assert.ok(pptOpt, "PowerPoint option must be present");
  const pptSvg = pptOpt.querySelector("svg");
  assert.ok(pptSvg, "PowerPoint must have an SVG logo");
  assert.ok(
    pptSvg.innerHTML.includes("#c43e1c") || pptSvg.innerHTML.includes("#ed6c47"),
    "PowerPoint logo must include Microsoft PowerPoint official orange/coral colors"
  );

  // PDF option check
  const pdfOpt = options.find((opt) => opt.textContent.includes("@PDF"));
  assert.ok(pdfOpt, "PDF option must be present");
  const pdfSvg = pdfOpt.querySelector("svg");
  assert.ok(pdfSvg, "PDF must have an SVG logo");
  assert.ok(
    pdfSvg.innerHTML.includes("#e5252a") || pdfSvg.innerHTML.includes("#b30b00"),
    "PDF logo must include Adobe Acrobat red container"
  );
  assert.ok(
    pdfSvg.innerHTML.includes("25.53 18.44"),
    "PDF logo must include Adobe ribbon curve path"
  );

  dom.window.close();
});

test("artifacts.js: plugin selector does NOT open downwards on mobile", async () => {
  const artifactsSource = await fs.readFile(path.join(process.cwd(), "public/artifacts.js"), "utf8");
  const plugins = [
    { id: "word", name: "Word", icon: "document", description: "Create a Word document", status: "available" },
  ];

  const dom = new JSDOM(
    '<html lang="en"><body><section class="ask-shell is-empty"><div id="composer"><textarea id="askInput"></textarea></div></section></body></html>',
    { url: "http://localhost", runScripts: "outside-only" }
  );

  dom.window.fetch = async () => ({ ok: true, json: async () => ({ plugins }) });
  dom.window.innerWidth = 375; // Mobile screen width
  dom.window.eval(artifactsSource);

  let selection = [];
  const input = dom.window.document.querySelector("textarea");
  const body = dom.window.document.querySelector("#composer");

  dom.window.HelmerArtifacts.attachComposer({
    input,
    body,
    getSelection: () => selection,
    setSelection: (val) => { selection = val; },
  });

  await new Promise((resolve) => setImmediate(resolve));

  input.value = "@";
  input.setSelectionRange(1, 1);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  const selector = dom.window.document.querySelector(".ask-plugin-selector");
  assert.ok(selector, "Plugin selector popup must exist");
  assert.equal(selector.classList.contains("is-downwards"), false, "Plugin selector must NOT have is-downwards on mobile");

  dom.window.close();
});

test("script.js: '+' popover opens downwards ONLY on desktop on main page", async () => {
  const js = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");

  // Build mode intake checks desktop breakpoint
  assert.ok(
    js.includes("window.innerWidth >= 768") && js.includes("renderIntake"),
    "Build intake context popover must check window.innerWidth >= 768"
  );
  assert.ok(
    js.includes('`ask-context-popover${isDesktop ? " is-downwards" : ""}`'),
    "Build intake must set is-downwards conditionally based on desktop"
  );

  // Ask mode checks desktop breakpoint and !isChatActive
  assert.ok(
    js.includes('`ask-context-popover${!isChatActive && isDesktop ? " is-downwards" : ""}`'),
    "Ask context popover must set is-downwards only on desktop when !isChatActive"
  );
  assert.ok(
    js.includes("!isChatActive && typeof window !== \"undefined\" && window.innerWidth >= 768"),
    "drawContextMenu must check both !isChatActive and desktop width"
  );
});

test("style.css & artifacts.css: downwards popover and plugin selector strictly scoped to @media (min-width: 768px)", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  const artCss = await fs.readFile(path.join(process.cwd(), "public/artifacts.css"), "utf8");

  // Both style.css and artifacts.css must scope downwards rules under @media (min-width: 768px)
  assert.ok(
    css.includes("@media (min-width: 768px)"),
    "style.css must have desktop media query"
  );
  assert.ok(
    artCss.includes("@media (min-width: 768px)"),
    "artifacts.css must have desktop media query"
  );

  // Desktop downwards rules
  assert.ok(
    css.includes(".workspace-intake .ask-context-popover") && css.includes(".workspace-intake .ask-plugin-selector"),
    "style.css styles downwards .ask-context-popover and .ask-plugin-selector on main page"
  );
  assert.ok(
    artCss.includes(".ask-plugin-selector.is-downwards"),
    "artifacts.css styles downwards .ask-plugin-selector"
  );

  // Base mobile rule in style.css stays intact
  assert.ok(
    css.includes(".ask-context-menu > .ask-context-popover"),
    "mobile suppression rule is preserved"
  );
});
