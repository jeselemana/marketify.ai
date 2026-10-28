import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const source = await fs.readFile(new URL("../public/script.js", import.meta.url), "utf8");
const routeSource = source.slice(source.indexOf("function openRecentWorkArchive()"), source.indexOf('document.querySelector("#recentViewAll").addEventListener'));
const searchSource = source.slice(source.indexOf("function openSearchModal("), source.indexOf("// ── PWA Installation"));

test("Recent Work opens Ask history in Ask and preserves Build archive handler", () => {
  const calls = [];
  const context = vm.createContext({ state: { mode: "ask" }, openSearchModal: options => calls.push(options.allChats), strategiesNav: { click: () => calls.push("build") } });
  vm.runInContext(routeSource, context);
  context.openRecentWorkArchive();
  context.state.mode = "build";
  context.openRecentWorkArchive();
  assert.deepEqual(calls, [true, "build"]);
});

test("Ask View all lists every chat and keeps searches within chat history", () => {
  const { window } = new JSDOM('<!doctype html><body></body>');
  const { document } = window;
  const selected = [];
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const context = vm.createContext({
    document, element, searchModalOverlay: null,
    state: { mode: "ask", identityEpoch: 1, currentUser: { id: "user" }, savedChats: Array.from({ length: 25 }, (_, i) => ({ id: `chat-${i}`, title: `Conversation ${i}` })), savedStrategies: [{ id: "build", title: "Build only" }] },
    getLanguage: () => "en", closeSidebar() {}, closeSearchModal() {},
    openSavedChat: id => selected.push(id), openSavedStrategy() { throw Error("Unexpected Build navigation"); },
    i18nFormatDate: () => "", setTimeout() {},
    button: (text, className, action) => { const node = element("button", className, text); node.addEventListener("click", action); return node; },
  });
  vm.runInContext(searchSource, context);
  context.openSearchModal({ allChats: true });
  assert.equal(document.querySelectorAll(".sidebar-search-item").length, 25);
  document.querySelectorAll(".sidebar-search-item")[24].click();
  assert.deepEqual(selected, ["chat-24"]);
  const input = document.querySelector("input");
  input.value = "Build only";
  input.dispatchEvent(new window.Event("input"));
  assert.equal(document.querySelectorAll(".sidebar-search-item").length, 0);
  window.close();
});
