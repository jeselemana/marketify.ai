import { createDocumentExport, createSpreadsheetExport, exportStrategyToPDF } from "./exporters.js";
import { authRequest, initializeAuthentication, logout } from "./auth.js";

const workspace = document.querySelector("#workspace");
const sidebar = document.querySelector("#sidebar");
const mobileOverlay = document.querySelector("#mobileOverlay");
const mobileMenuButton = document.querySelector("#mobileMenuButton");
const railMenuButton = document.querySelector("#railMenuButton");
const railHomeButton = document.querySelector("#railHomeButton");
const railStrategiesButton = document.querySelector("#railStrategiesButton");
const railPlannerButton = document.querySelector("#railPlannerButton");
const railModeToggleButton = document.querySelector("#railModeToggleButton");
const sidebarClose = document.querySelector("#sidebarClose");
const newStrategyButton = document.querySelector("#newStrategyButton");
const sidebarLabel = document.querySelector(".sidebar-label");
const toastRegion = document.querySelector("#toastRegion");
const recentList = document.querySelector("#recentList");
const strategyCount = document.querySelector("#strategyCount");
const plannerCount = document.querySelector("#plannerCount");
const homeNav = document.querySelector("#homeNav");
const strategiesNav = document.querySelector("#strategiesNav");
const plannerNav = document.querySelector("#plannerNav");
const settingsNav = document.querySelector("#settingsNav");
const accountButton = document.querySelector("#accountButton");
const workspaceAvatar = document.querySelector("#workspaceAvatar");
const workspaceName = document.querySelector("#workspaceName");
const workspaceMeta = document.querySelector("#workspaceMeta");
const buildModeButton = document.querySelector("#buildModeButton");
const askModeButton = document.querySelector("#askModeButton");
const sidebarBuildModeButton = document.querySelector("#sidebarBuildModeButton");
const sidebarAskModeButton = document.querySelector("#sidebarAskModeButton");

const STATUS_LABELS = {
  draft: "Qaralama",
  analyzing: "Analiz edilir",
  needs_clarification: "Məlumat gözlənilir",
  generating: "Hazırlanır",
  ready: "Hazırdır",
  refining: "Yenilənir",
  saved: "Yadda saxlanıb",
  error: "Xəta",
};

const QUICK_ACTIONS = [
  ["shorten", "Qısalt"],
  ["localize_azerbaijan", "Lokallaşdır"],
  ["think_deeper", "Daha dərindən düşün"],
  ["make_practical", "Praktik et"],
  ["budget_optimize", "Büdcəni optimallaşdır"],
];

const state = {
  mode: "build",
  view: "home",
  status: "draft",
  brief: "",
  questions: [],
  clarificationIndex: 0,
  clarificationDrafts: {},
  answers: [],
  assumptions: [],
  understanding: "",
  round: 0,
  strategy: null,
  versions: [],
  savedId: null,
  clientSaveId: crypto.randomUUID(),
  savedStrategies: [],
  updatedAt: null,
  error: null,
  retry: null,
  changeSummary: "",
  askChatId: null,
  savedChats: [],
  plannerTasks: [],
  plannerFilter: "all",
  askMessages: [],
  askLoading: false,
  askError: "",
  askStrategyId: "",
  currentUser: null,
  settingsTab: "account",
  strategyFormat: "blog",
  faqFilter: "",
  faqExpandedAll: false,
};

let progressTimer;
const freshAskResponses = new WeakSet();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const node = element("button", className, label);
  node.type = "button";
  if (onClick) node.addEventListener("click", onClick);
  return node;
}

function setStatus(status) {
  state.status = status;
  document.body.dataset.status = status;
}

function trackEvent(name, metadata = {}) {
  window.dispatchEvent(
    new CustomEvent("marketify:analytics", {
      detail: { name, metadata, timestamp: new Date().toISOString() },
    }),
  );
}

function formatDate(value) {
  if (!value) return "İndi";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "İndi";
  
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}`;
  
  if (isToday) {
    return `Bu gün, ${time}`;
  }
  if (isYesterday) {
    return `Dünən, ${time}`;
  }
  
  const months = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
  const day = date.getDate();
  const month = months[date.getMonth()] || "";
  
  if (date.getFullYear() === now.getFullYear()) {
    return `${day} ${month}, ${time}`;
  }
  return `${day} ${month} ${date.getFullYear()}`;
}

function formatTimeOnly(value) {
  if (!value) return "00:00";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "00:00";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function slugify(value) {
  return (value || "marketify-strategy")
    .toLocaleLowerCase("az")
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64) || "marketify-strategy";
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
  } catch {
    throw new Error(navigator.onLine ? "Strategiyanı hazırlamaq mümkün olmadı. Bir neçə saniyə sonra yenidən yoxla." : "İnternet bağlantısı yoxdur.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && data.code === "AUTH_REQUIRED") {
      window.dispatchEvent(new CustomEvent("marketify:auth-required"));
    }
    const safeMessage = path === "/api/ask"
      ? data.error || "Cavabı hazırlamaq mümkün olmadı."
      : ["AI_AUTH_ERROR", "AI_NOT_CONFIGURED", "STRATEGY_ERROR"].includes(data.code)
      ? "Strategiyanı hazırlamaq mümkün olmadı. Bir neçə saniyə sonra yenidən yoxla."
      : data.error || "Sorğunu tamamlamaq mümkün olmadı.";
    const error = new Error(safeMessage);
    error.code = data.code;
    throw error;
  }
  return data;
}

function showToast(message, tone = "success") {
  const toast = element("div", `toast toast-${tone}`);
  const dot = element("span", "toast-dot");
  dot.setAttribute("aria-hidden", "true");
  toast.append(dot, element("span", "", message));
  toastRegion.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 220);
  }, 3600);
}

function showRegistrationNotice() {
  if (document.querySelector(".entry-notice")) return;
  const notice = element("aside", "entry-notice");
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.append(
    element("span", "entry-notice-mark", "i"),
    element(
      "p",
      "",
      "Profilə giriş/qeydiyyat üzrə yaranan texniki çətinlik aradan qaldırılmışdır. Profilinizə asanlıqla daxil ola, keçmiş söhbətlərinizi görə və sessiyanı aktiv saxlaya bilərsiniz.",
    ),
  );
  document.body.appendChild(notice);
  requestAnimationFrame(() => notice.classList.add("is-visible"));
  setTimeout(() => {
    notice.classList.remove("is-visible");
    setTimeout(() => notice.remove(), 220);
  }, 10_000);
}

function setError(error, retry, returnStatus = "draft") {
  state.error = error?.message || "Gözlənilməz xəta baş verdi.";
  state.retry = retry;
  setStatus(returnStatus);
  render();
}

function clearError() {
  state.error = null;
  state.retry = null;
}

function errorBanner() {
  if (!state.error) return null;
  const banner = element("div", "error-banner");
  const copy = element("div");
  copy.append(element("strong", "", "Sorğu tamamlanmadı"), element("p", "", state.error));
  banner.append(copy);
  if (state.retry) {
    banner.append(
      button("Yenidən cəhd et", "secondary-button compact", () => {
        const retry = state.retry;
        clearError();
        retry();
      }),
    );
  }
  return banner;
}

function openSidebar() {
  sidebar.classList.add("is-open");
  document.body.classList.add("sidebar-open");
  mobileOverlay.hidden = false;
  mobileMenuButton.setAttribute("aria-expanded", "true");
  railMenuButton.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  sidebar.classList.remove("is-open");
  document.body.classList.remove("sidebar-open");
  mobileOverlay.hidden = true;
  mobileMenuButton.setAttribute("aria-expanded", "false");
  railMenuButton.setAttribute("aria-expanded", "false");
}

function syncNav() {
  const isBuild = state.mode === "build";
  homeNav.classList.toggle("is-active", isBuild ? !["list", "settings", "planner"].includes(state.view) : state.view !== "settings");
  strategiesNav.classList.toggle("is-active", isBuild && state.view === "list");
  plannerNav?.classList.toggle("is-active", isBuild && state.view === "planner");
  settingsNav.classList.toggle("is-active", state.view === "settings");
  railHomeButton.classList.toggle("is-active", isBuild ? !["list", "settings", "planner"].includes(state.view) : state.view !== "settings");
  railStrategiesButton.classList.toggle("is-active", isBuild && state.view === "list");
  railPlannerButton?.classList.toggle("is-active", isBuild && state.view === "planner");

  const homeLabel = homeNav.querySelector("span");
  if (homeLabel) {
    homeLabel.textContent = isBuild ? "Başlanğıc" : "Sual-Cavab";
  }

  const newButtonSpan = newStrategyButton?.querySelector("span");
  if (newButtonSpan) {
    newButtonSpan.textContent = isBuild ? "Yeni strategiya" : "Yeni söhbət";
  }

  if (sidebarLabel) {
    sidebarLabel.textContent = isBuild ? "Son işlər" : "Keçmiş söhbətlər";
  }
}

function syncMode() {
  const isBuild = state.mode === "build";
  buildModeButton?.classList.toggle("is-active", isBuild);
  askModeButton?.classList.toggle("is-active", !isBuild);
  buildModeButton?.setAttribute("aria-selected", String(isBuild));
  askModeButton?.setAttribute("aria-selected", String(!isBuild));

  sidebarBuildModeButton?.classList.toggle("is-active", isBuild);
  sidebarAskModeButton?.classList.toggle("is-active", !isBuild);
  sidebarBuildModeButton?.setAttribute("aria-selected", String(isBuild));
  sidebarAskModeButton?.setAttribute("aria-selected", String(!isBuild));

  if (railModeToggleButton) {
    railModeToggleButton.setAttribute(
      "data-tooltip",
      isBuild ? "Rejim: Build (Ask-a keç)" : "Rejim: Ask (Build-ə keç)",
    );
    railModeToggleButton.setAttribute(
      "aria-label",
      isBuild ? "Ask rejiminə keç" : "Build rejiminə keç",
    );
  }

  document.body.dataset.mode = state.mode;
}

function setMode(mode) {
  if (!['build', 'ask'].includes(mode) || state.mode === mode) return;
  state.mode = mode;
  state.view = "home";
  syncMode();
  syncNav();
  renderRecentList();
  render();
  closeSidebar();
  if (mode === "ask" && !state.savedChats.length) {
    loadSavedChats();
  }
}

function startNewChat() {
  clearInterval(progressTimer);
  state.mode = "ask";
  state.view = "home";
  state.askChatId = null;
  state.askMessages = [];
  state.askStrategyId = "";
  state.askError = "";
  render();
  closeSidebar();
}

function resetStrategy() {
  clearInterval(progressTimer);
  Object.assign(state, {
    mode: "build",
    view: "home",
    status: "draft",
    brief: "",
    questions: [],
    clarificationIndex: 0,
    clarificationDrafts: {},
    answers: [],
    assumptions: [],
    understanding: "",
    round: 0,
    strategy: null,
    versions: [],
    savedId: null,
    clientSaveId: crypto.randomUUID(),
    updatedAt: null,
    error: null,
    retry: null,
    changeSummary: "",
    strategyFormat: "blog",
    faqFilter: "",
    faqExpandedAll: false,
  });
  render();
  closeSidebar();
}

function render() {
  clearInterval(progressTimer);
  syncMode();
  syncNav();
  workspace.replaceChildren();
  workspace.className = "workspace";

  if (state.view === "settings") return renderSettings();
  if (state.view === "planner") return renderPlannerView();
  if (state.mode === "ask") return renderAsk();
  if (state.view === "list") return renderStrategyList();
  if (["analyzing", "generating"].includes(state.status)) return renderLoading();
  if (state.status === "needs_clarification") return renderClarification();
  if (state.strategy) return renderStrategyWorkspace();
  return renderIntake();
}

function renderIntake() {
  workspace.classList.add("workspace-centered", "workspace-intake");

  const view = element("section", "intake-view");
  view.setAttribute("aria-labelledby", "intakeTitle");

  const intro = element("div", "intake-intro");
  intro.append(
    element("h1", "intake-title", "Növbəti strategiyanı quraq."),
    element("p", "intake-description", "Biznes məqsədini, ideyanı və ya həll etmək istədiyin problemi yaz."),
  );
  
  const form = element("form", "composer-card");
  const label = element("label", "sr-only", "Strategiya brifi");
  label.htmlFor = "briefInput";
  const textarea = element("textarea", "composer-input");
  textarea.id = "briefInput";
  textarea.name = "brief";
  textarea.rows = 1;
  textarea.maxLength = 8000;
  textarea.placeholder = window.innerWidth <= 767
    ? "Məqsədini və ya problemi yaz…"
    : "Biznes məqsədini və ya həll etmək istədiyin problemi yaz…";
  textarea.value = state.brief;
  const footer = element("div", "composer-footer");
  const composerTools = element("div", "composer-tools");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".txt,.md,.csv,.json,text/plain,text/csv,application/json";
  fileInput.hidden = true;
  const attach = button("", "composer-tool");
  attach.setAttribute("aria-label", "Fayl əlavə et");
  attach.title = "Fayl əlavə et";
  attach.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 11.5-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 1 1-2.8-2.8l8.9-8.9" /></svg>';
  attach.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const content = (await file.text()).trim();
      const addition = `\n\nƏlavə fayl — ${file.name}:\n${content}`;
      textarea.value = `${textarea.value.trim()}${addition}`.trim().slice(0, textarea.maxLength);
      state.brief = textarea.value;
      submit.disabled = state.brief.length < 8;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 280)}px`;
      showToast(`${file.name} brifə əlavə edildi.`);
    } catch {
      showToast("Faylı oxumaq mümkün olmadı.", "error");
    }
    fileInput.value = "";
  });
  const hint = element("span", "composer-hint", "Enter göndərir · Shift + Enter yeni sətir");
  composerTools.append(attach, hint);
 const submit = button("", "primary-button composer-submit");
submit.type = "submit";
submit.disabled = state.brief.trim().length < 8;
submit.setAttribute("aria-label", "Strategiyanı qur");
submit.appendChild(element("span", "button-arrow", "↑"));
  footer.append(composerTools, submit);
  form.append(label, textarea, fileInput, footer);

  textarea.addEventListener("input", () => {
    state.brief = textarea.value;
    submit.disabled = textarea.value.trim().length < 8;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  });
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && window.innerWidth > 700) {
      event.preventDefault();
      if (!submit.disabled) form.requestSubmit();
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    state.brief = textarea.value.trim();
    if (state.brief.length >= 8) startAssessment();
  });

  const examples = element("div", "examples");
  examples.append(element("span", "examples-label", "İlham üçün"));
  [
    "Bakıda yeni kafe üçün launch strategiyası",
    "E-commerce təkrar sifariş planı",
    "Instagram kampaniyasını optimallaşdır",
  ].forEach((prompt) => {
    examples.append(
      button(prompt, "example-chip", () => {
        state.brief = prompt;
        textarea.value = prompt;
        submit.disabled = false;
        textarea.focus();
      }),
    );
  });

  const banner = errorBanner();
  if (banner) view.appendChild(banner);
  view.append(intro, form, examples);
  workspace.appendChild(view);
  if (window.innerWidth > 767) setTimeout(() => textarea.focus(), 0);
}

function appendAskInline(parent, value) {
  const parts = String(value).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  parts.forEach((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      parent.appendChild(element("strong", "", part.slice(2, -2)));
    } else if (part.startsWith("`") && part.endsWith("`")) {
      parent.appendChild(element("code", "", part.slice(1, -1)));
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  });
}

function askTableCells(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function renderAskRichText(value) {
  const root = element("div", "ask-rich-text");
  const lines = String(value || "").replace(/\r/g, "").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("```") ) {
      const language = line.slice(3).trim();
      const content = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) content.push(lines[index++]);
      if (index < lines.length) index += 1;
      const pre = element("pre", "ask-code-block");
      const code = element("code", language ? `language-${language}` : "", content.join("\n"));
      pre.appendChild(code);
      root.appendChild(pre);
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(4, heading[1].length);
      const node = element(`h${level}`, "");
      appendAskInline(node, heading[2]);
      root.appendChild(node);
      index += 1;
      continue;
    }

    if (line.includes("|") && lines[index + 1]?.includes("|") && /^\|?[\s:|-]+\|?$/.test(lines[index + 1].trim())) {
      const tableWrap = element("div", "ask-table-wrap");
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      askTableCells(line).forEach((cell) => {
        const th = document.createElement("th");
        appendAskInline(th, cell);
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      index += 2;
      const tbody = document.createElement("tbody");
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        const row = document.createElement("tr");
        askTableCells(lines[index]).forEach((cell) => {
          const td = document.createElement("td");
          appendAskInline(td, cell);
          row.appendChild(td);
        });
        tbody.appendChild(row);
        index += 1;
      }
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      root.appendChild(tableWrap);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const list = document.createElement("ul");
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        const item = document.createElement("li");
        appendAskInline(item, lines[index].trim().replace(/^[-*]\s+/, ""));
        list.appendChild(item);
        index += 1;
      }
      root.appendChild(list);
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const list = document.createElement("ol");
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        const item = document.createElement("li");
        appendAskInline(item, lines[index].trim().replace(/^\d+[.)]\s+/, ""));
        list.appendChild(item);
        index += 1;
      }
      root.appendChild(list);
      continue;
    }

    const paragraph = element("p");
    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{2,4})\s+|^[-*]\s+|^\d+[.)]\s+|^```/.test(lines[index].trim())) {
      if (lines[index].includes("|") && lines[index + 1]?.includes("|")) break;
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    appendAskInline(paragraph, paragraphLines.join(" "));
    root.appendChild(paragraph);
  }
  return root;
}

async function copyAskResponse(content, successMessage = "Cavab kopyalandı.") {
  try {
    await navigator.clipboard.writeText(content);
    showToast(successMessage, "neutral");
    return true;
  } catch {
    showToast("Cavabı kopyalamaq mümkün olmadı.", "error");
    return false;
  }
}

async function shareAskResponse(content) {
  if (navigator.share) {
    try {
      await navigator.share({ title: "Marketify cavabı", text: content });
      trackEvent("ask_response_shared", { method: "native" });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  const copied = await copyAskResponse(content, "Paylaşmaq üçün cavab kopyalandı.");
  if (copied) trackEvent("ask_response_shared", { method: "clipboard" });
}

function renderAsk() {
  workspace.classList.add("workspace-ask");
  const isChatActive = Boolean(state.askMessages.length || state.askLoading);
  workspace.classList.toggle("has-messages", isChatActive);
  workspace.classList.toggle("is-empty", !isChatActive);

  const selectedStrategy = state.savedStrategies.find((strategy) => strategy.id === state.askStrategyId) || null;
  const shell = element("section", `ask-shell${isChatActive ? " has-messages" : " is-empty"}`);
  shell.setAttribute("aria-label", "Ask");
  const thread = element("div", "ask-thread");

  if (!state.askMessages.length) {
    const intro = element("div", "ask-intro");
    intro.append(
      element("h1", "ask-title", "Nə haqda düşünürsən?"),
      element("p", "ask-subtitle", "Sualını, ideyanı və ya həll etmək istədiyin problemi yaz."),
    );
    thread.appendChild(intro);
  } else {
    state.askMessages.forEach((message) => {
      const isFreshResponse = message.role === "assistant" && freshAskResponses.has(message);
      const row = element("article", `ask-message ask-message-${message.role}${isFreshResponse ? " is-fresh" : ""}`);
      const content = element("div", "ask-message-content");
      if (message.role === "assistant") {
        content.appendChild(renderAskRichText(message.content));
        const actions = element("div", "ask-message-actions");
        actions.setAttribute("aria-label", "Cavab əməliyyatları");
        const copy = button("", "ask-response-action", async () => {
          const ok = await copyAskResponse(message.content);
          if (ok) {
            copy.classList.add("is-copied");
            copy.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Kopyalandı</span>';
            setTimeout(() => {
              copy.classList.remove("is-copied");
              copy.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>Kopyala</span>';
            }, 1800);
          }
        });
        copy.setAttribute("aria-label", "Cavabı kopyala");
        copy.title = "Kopyala";
        copy.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>Kopyala</span>';

        const share = button("", "ask-response-action", () => shareAskResponse(message.content));
        share.setAttribute("aria-label", "Cavabı paylaş");
        share.title = "Paylaş";
        share.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg><span>Paylaş</span>';

        actions.append(copy, share);
        content.appendChild(actions);
        if (isFreshResponse) {
          const caret = element("span", "ask-answer-caret");
          content.appendChild(caret);
          setTimeout(() => caret.remove(), 900);
        }
      } else {
        content.textContent = message.content;
        if (message.strategyTitle) {
          content.appendChild(element("span", "ask-message-context", `Strategiya: ${message.strategyTitle}`));
        }
      }
      row.appendChild(content);
      thread.appendChild(row);
    });
    if (state.askLoading) {
      const row = element("article", "ask-message ask-message-assistant is-loading");
      row.setAttribute("aria-live", "polite");
      const thinking = element("div", "ask-thinking");
      const mark = element("span", "ask-thinking-mark");
      mark.append(element("i"), element("i"), element("i"));
      const thinkingLabel = element("span", "ask-thinking-label", "Kontekst nəzərdən keçirilir");
      const dots = element("span", "ask-thinking-dots");
      dots.append(element("i"), element("i"), element("i"));
      thinking.append(mark, thinkingLabel, dots);
      row.appendChild(thinking);
      thread.appendChild(row);
      const thinkingPhrases = ["Kontekst nəzərdən keçirilir", "Cavab strukturlaşdırılır", "Yekun cavab hazırlanır"];
      let thinkingPhase = 0;
      progressTimer = setInterval(() => {
        if (!thinkingLabel.isConnected) return clearInterval(progressTimer);
        thinkingPhase = (thinkingPhase + 1) % thinkingPhrases.length;
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          thinkingLabel.animate(
            [{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }],
            { duration: 180, easing: "ease-out" },
          );
        }
        thinkingLabel.textContent = thinkingPhrases[thinkingPhase];
      }, 1400);
    }
  }

  if (state.askError) {
    const error = element("div", "ask-error");
    error.append(
      element("strong", "", state.askError),
      element("span", "", navigator.onLine ? "Bir neçə saniyə sonra yenidən yoxla." : "İnternet bağlantını yoxla."),
    );
    thread.appendChild(error);
  }

  const composerArea = element("div", "ask-composer-area");
  if (!state.askMessages.length) {
    const suggestions = element("div", "ask-suggestions");
    ["Bu ideyanın güclü və zəif tərəfləri nədir?", "Müştəri segmentasiyasını necə qurum?", "Bu həftə hansı KPI-lara baxmalıyam?"].forEach((prompt) => {
      suggestions.appendChild(button(prompt, "ask-suggestion"));
    });
    composerArea.appendChild(suggestions);
  }
  const contextMenu = document.createElement("details");
  contextMenu.className = `ask-context-menu${selectedStrategy ? " has-selection" : ""}`;
  const contextTrigger = element("summary", "ask-context-trigger");
  contextTrigger.setAttribute("aria-label", "Strategiya arxivindən seç");
  contextTrigger.title = selectedStrategy ? `Kontekst: ${selectedStrategy.title}` : "Strategiya arxivindən seç";
  contextTrigger.appendChild(element("span", "ask-context-plus", "+"));
  const contextPopover = element("div", "ask-context-popover");
  contextPopover.appendChild(element("strong", "ask-context-title", "Strategiya arxivindən seç"));
  const contextList = element("div", "ask-context-list");
  if (state.savedStrategies.length) {
    state.savedStrategies.forEach((strategy) => {
      const item = button("", `ask-context-item${strategy.id === state.askStrategyId ? " is-selected" : ""}`);
      item.append(
        element("span", "", strategy.title),
        element("small", "", strategy.id === state.askStrategyId ? "Seçilib" : formatDate(strategy.updatedAt)),
      );
      item.addEventListener("click", () => {
        state.askStrategyId = strategy.id;
        contextMenu.open = false;
        render();
      });
      contextList.appendChild(item);
    });
  } else {
    const emptyContext = element("div", "ask-context-empty");
    emptyContext.append(
      element("span", "", "Arxiv hələ boşdur."),
      element("small", "", "Build bölməsində strategiya yaradıb yadda saxla."),
    );
    contextList.appendChild(emptyContext);
  }
  contextPopover.appendChild(contextList);
  if (selectedStrategy) {
    const clearContext = button("Konteksti sil", "ask-context-clear", () => {
      state.askStrategyId = "";
      contextMenu.open = false;
      render();
    });
    contextPopover.appendChild(clearContext);
  }
  const openArchive = button("Strategiyalar arxivinə keç →", "ask-context-archive", () => {
    contextMenu.open = false;
    state.mode = "build";
    state.view = "list";
    render();
  });
  contextPopover.appendChild(openArchive);
  contextMenu.append(contextTrigger, contextPopover);
  contextMenu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") contextMenu.open = false;
  });
  const closeContextMenu = (event) => {
    if (!contextMenu.contains(event.target)) contextMenu.open = false;
  };
  contextMenu.addEventListener("toggle", () => {
    if (contextMenu.open) setTimeout(() => document.addEventListener("click", closeContextMenu), 0);
    else document.removeEventListener("click", closeContextMenu);
  });
  const form = element("form", "ask-composer");
  const label = element("label", "sr-only", "Ask sualı");
  label.htmlFor = "askInput";
  const input = element("textarea", "ask-input");
  input.id = "askInput";
  input.name = "message";
  input.rows = 1;
  input.maxLength = 8000;
  input.placeholder = "Marketify-dən soruş…";
  input.disabled = state.askLoading;
  const submit = button("", "ask-submit");
  submit.type = "submit";
  submit.disabled = true;
  submit.setAttribute("aria-label", "Sualı göndər");
  submit.appendChild(element("span", "", "↑"));
  form.append(contextMenu, label, input, submit);
  const helper = element("div", "ask-composer-meta");
  const contextMeta = element("span", "ask-context-meta", selectedStrategy ? `Kontekst: ${selectedStrategy.title}` : "Marketify");
  helper.append(contextMeta, element("span", "", "Enter ilə göndər · Shift + Enter yeni sətir"));
  composerArea.append(form, helper);
  shell.append(thread, composerArea);
  workspace.appendChild(shell);

  const resizeInput = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    submit.disabled = input.value.trim().length < 2 || state.askLoading;
  };
  input.addEventListener("input", resizeInput);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!submit.disabled) form.requestSubmit();
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (message.length >= 2) submitAskMessage(message);
  });
  composerArea.querySelectorAll(".ask-suggestion").forEach((suggestion) => {
    suggestion.addEventListener("click", () => {
      input.value = suggestion.textContent;
      resizeInput();
      input.focus();
    });
  });

  requestAnimationFrame(() => {
    if (state.askMessages.length) composerArea.scrollIntoView({ block: "end" });
    if (!state.askLoading && window.innerWidth > 767) input.focus();
  });
}

async function submitAskMessage(message) {
  const selectedStrategy = state.savedStrategies.find((strategy) => strategy.id === state.askStrategyId) || null;
  state.askMessages.push({ role: "user", content: message, strategyTitle: selectedStrategy?.title || "" });
  state.askLoading = true;
  state.askError = "";
  trackEvent("ask_message_sent", { messageCount: state.askMessages.length });
  render();
  try {
    const data = await api("/api/ask", {
      method: "POST",
      body: JSON.stringify({
        messages: state.askMessages,
        strategyId: state.askStrategyId || undefined,
        chatId: state.askChatId || undefined,
      }),
    });
    const response = { role: "assistant", content: data.reply };
    freshAskResponses.add(response);
    state.askMessages.push(response);
    if (data.chat?.id) {
      state.askChatId = data.chat.id;
      loadSavedChats();
    }
    setTimeout(() => freshAskResponses.delete(response), 1000);
  } catch (error) {
    state.askError = error.message;
  } finally {
    state.askLoading = false;
    render();
  }
}

function renderLoading() {
  workspace.classList.add("workspace-centered");
  const isAssessment = state.status === "analyzing";
  const phases = isAssessment
    ? [
        ["Brif strukturlaşdırılır", "Biznes məqsədini, bazarı və əsas məhdudiyyətləri vahid kontekstdə toplayıram."],
        ["Kritik boşluqlar yoxlanılır", "Yalnız strategiyanın keyfiyyətini dəyişəcək məlumatların çatışıb-çatışmadığını yoxlayıram."],
        ["Növbəti addım seçilir", "Mövcud məlumatla davam etmək və ya qısa dəqiqləşdirmə istəmək qərarı hazırlanır."],
      ]
    : [
        ["Brif strukturlaşdırılır", "Auditoriya, məqsəd, vaxt və büdcə bir strateji çərçivədə birləşdirilir."],
        ["Prioritetlər müəyyən edilir", "Ən yüksək təsir yaradacaq qərarlar və asılılıqlar sıralanır."],
        ["Strategiya qurulur", "Mövqelənmə, kanallar və təklif vahid istiqamətdə əlaqələndirilir."],
        ["İcra planı hazırlanır", "Strateji qərarlar ardıcıl və icra edilə bilən mərhələlərə çevrilir."],
        ["Ölçü və risklər yoxlanılır", "KPI-lar, risklər və növbəti addımlar strategiya ilə uyğunlaşdırılır."],
      ];
  let currentPhase = 0;
  const view = element("section", `loading-view ${isAssessment ? "is-assessment" : "is-generation"}`);
  view.setAttribute("aria-live", "polite");
  const statusLine = element("div", "loading-status-line");
  statusLine.append(
    element("span", "loading-live-dot"),
    element("span", "loading-eyebrow", isAssessment ? "BRİF ANALİZİ" : "STRATEGİYA HAZIRLANIR"),
  );
  const title = element(
    "h1",
    "loading-title",
    isAssessment ? "Brifdən növbəti qərara" : "Brifdən icra planına",
  );
  const intro = element(
    "p",
    "loading-intro",
    isAssessment
      ? "Məlumatları yoxlayıb ən doğru növbəti addımı müəyyənləşdiririk."
      : "Marketify daxil etdiyin konteksti strukturlaşdırılmış strategiyaya çevirir.",
  );

  const activity = element("div", "loading-activity");
  const activityTop = element("div", "loading-activity-top");
  const activityLabel = element("span", "loading-activity-label", "Hazırda");
  const activityCount = element("span", "loading-activity-count", `01 / ${String(phases.length).padStart(2, "0")}`);
  activityTop.append(activityLabel, activityCount);
  const activityBody = element("div", "loading-activity-body");
  const activityIndicator = element("span", "loading-activity-indicator");
  activityIndicator.append(element("span", "loading-activity-spark"));
  const activityText = element("div", "loading-activity-text");
  const activityTitle = element("strong", "", phases[0][0]);
  const copy = element("p", "loading-copy", phases[0][1]);
  activityText.append(activityTitle, copy);
  activityBody.append(activityIndicator, activityText);
  activity.append(activityTop, activityBody);

  const progress = element("ol", "generation-steps");
  phases.forEach(([phase], index) => {
    const step = element("li", index === 0 ? "is-current" : "is-upcoming");
    step.append(
      element("span", "generation-step-mark", index === 0 ? "01" : String(index + 1).padStart(2, "0")),
      element("span", "generation-step-label", phase),
    );
    progress.appendChild(step);
  });
  const reassurance = element(
    "p",
    "loading-reassurance",
    isAssessment
      ? "Vacib detal çatışmasa, yalnız zəruri sualları verəcəyik."
      : "Məzmun hazır olduqda birbaşa strategiya iş sahəsinə keçəcəksən.",
  );
  view.append(statusLine, title, intro, activity, progress, reassurance);
  workspace.appendChild(view);

  progressTimer = setInterval(() => {
    currentPhase = Math.min(currentPhase + 1, phases.length - 1);
    activityTitle.textContent = phases[currentPhase][0];
    copy.textContent = phases[currentPhase][1];
    activityCount.textContent = `${String(currentPhase + 1).padStart(2, "0")} / ${String(phases.length).padStart(2, "0")}`;
    [...progress.children].forEach((step, index) => {
      step.className = index < currentPhase ? "is-complete" : index === currentPhase ? "is-current" : "is-upcoming";
      step.querySelector(".generation-step-mark").textContent = index < currentPhase ? "✓" : String(index + 1).padStart(2, "0");
    });
    if (currentPhase === phases.length - 1) clearInterval(progressTimer);
  }, 1500);
}

async function startAssessment() {
  if (state.round === 0 && state.answers.length === 0) trackEvent("strategy_started");
  clearError();
  setStatus("analyzing");
  render();
  try {
    const data = await api("/api/strategy/assess", {
      method: "POST",
      body: JSON.stringify({
        brief: state.brief,
        answers: state.answers,
        round: state.round,
      }),
    });
    const assessment = data.assessment;
    state.understanding = assessment.understanding;
    state.assumptions = assessment.assumptions || [];
    if (assessment.status === "needs_clarification") {
      state.questions = assessment.questions;
      state.clarificationIndex = 0;
      state.clarificationDrafts = {};
      trackEvent("clarification_requested", { questionCount: assessment.questions.length, round: state.round + 1 });
      setStatus("needs_clarification");
      render();
      return;
    }
    await startGeneration();
  } catch (error) {
    setError(error, startAssessment, state.answers.length ? "needs_clarification" : "draft");
  }
}

function renderClarification() {
  workspace.classList.add("workspace-centered");
  const index = Math.min(state.clarificationIndex, state.questions.length - 1);
  const question = state.questions[index];
  if (!question) return startGeneration();
  const view = element("section", "clarification-view");
  view.setAttribute("aria-labelledby", "clarificationTitle");
  const top = element("div", "clarification-heading");
  top.append(
    element("div", "step-label", state.round ? "BİR DETAL DA DƏQİQLƏŞDİRƏK" : "QISA DƏQİQLƏŞDİRMƏ"),
    element("h1", "clarification-title", "Strategiyanı dəqiqləşdirək"),
    element("p", "clarification-copy", "Bir neçə vacib detal strategiyanı real biznesinə uyğunlaşdıracaq."),
  );

  const progressMeta = element("div", "clarification-progress-meta");
  progressMeta.append(element("span", "", `${index + 1} / ${state.questions.length}`), element("span", "", "Sual"));
  const progressTrack = element("div", "clarification-progress");
  const progressFill = element("span");
  progressFill.style.width = `${((index + 1) / state.questions.length) * 100}%`;
  progressTrack.appendChild(progressFill);

  const form = element("form", "clarification-form");
  const stage = element("div", "clarification-stage");
  stage.append(element("h2", "question-title", question.question));
  if (question.reason) stage.append(element("p", "question-reason", question.reason));

  let textInput;
  if (question.inputType === "text" || !question.options.length) {
    textInput = element("textarea", "question-input");
    textInput.name = question.id;
    textInput.rows = 4;
    textInput.maxLength = 1500;
    textInput.placeholder = "Cavabını qısa və konkret yaz…";
    textInput.value = state.clarificationDrafts[question.id] || "";
    stage.append(textInput, element("p", "question-example", "Məsələn: əsas məhsul, auditoriya, büdcə və ya fərqləndirici yanaşma."));
  } else {
    const options = element("div", "choice-grid");
    const selected = new Set(Array.isArray(state.clarificationDrafts[question.id]) ? state.clarificationDrafts[question.id] : [state.clarificationDrafts[question.id]].filter(Boolean));
    question.options.forEach((option) => {
      const label = element("label", "choice-pill");
      const input = document.createElement("input");
      input.type = question.inputType === "multi_choice" ? "checkbox" : "radio";
      input.name = question.id;
      input.value = option;
      input.checked = selected.has(option);
      label.append(input, element("span", "", option));
      options.appendChild(label);
    });
    stage.appendChild(options);
  }
  form.appendChild(stage);

  const context = document.createElement("details");
  context.className = "clarification-context";
  const contextSummary = element("summary", "", "Marketify nə bilir?");
  const contextBody = element("div", "clarification-context-body");
  const briefRow = element("div", "context-summary-row");
  briefRow.append(element("strong", "", "Brif"), element("span", "", state.brief.slice(0, 220)));
  contextBody.appendChild(briefRow);
  state.answers.slice(-3).forEach((answer) => {
    const row = element("div", "context-summary-row");
    row.append(element("strong", "", answer.question), element("span", "", answer.answer));
    contextBody.appendChild(row);
  });
  context.append(contextSummary, contextBody);

  const actions = element("div", "clarification-actions");
  const back = button("← Geri", "text-button", () => {
    if (index === 0) return;
    state.clarificationIndex = index - 1;
    render();
  });
  back.disabled = index === 0;
  const skip = button("Dəqiq bilmirəm", "text-button clarification-skip");
  const continueButton = button(index === state.questions.length - 1 ? "Tamamla" : "Davam et", "primary-button");
  continueButton.type = "submit";
  continueButton.appendChild(element("span", "button-arrow", "→"));
  const actionRight = element("div", "clarification-action-right");
  actionRight.append(skip, continueButton);
  actions.append(back, actionRight);
  form.append(context, actions);

  const advance = (answer) => {
    if (!answer) {
      showToast("Davam etmək üçün cavab seç və ya yaz.", "error");
      return;
    }
    state.clarificationDrafts[question.id] = question.inputType === "multi_choice" ? answer.split(", ") : answer;
    if (index < state.questions.length - 1) {
      state.clarificationIndex = index + 1;
      render();
      return;
    }
    const newAnswers = state.questions.map((item) => {
      const value = state.clarificationDrafts[item.id];
      return { questionId: item.id, question: item.question, answer: Array.isArray(value) ? value.join(", ") : value };
    });
    state.answers = [...state.answers, ...newAnswers];
    state.round += 1;
    trackEvent("clarification_completed", { answerCount: newAnswers.length, round: state.round });
    startAssessment();
  };

  skip.addEventListener("click", () => advance("Dəqiq məlum deyil — əsaslandırılmış işçi fərziyyə istifadə et."));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = textInput ? textInput.value.trim() : new FormData(form).getAll(question.id).join(", ").trim();
    advance(value);
  });
  textInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  const banner = errorBanner();
  if (banner) view.appendChild(banner);
  view.append(top, progressMeta, progressTrack, form);
  workspace.appendChild(view);
  setTimeout(() => textInput?.focus(), 0);
}

async function startGeneration() {
  clearError();
  setStatus("generating");
  render();
  try {
    const data = await api("/api/strategy/generate", {
      method: "POST",
      body: JSON.stringify({
        brief: state.brief,
        answers: state.answers,
        assumptions: state.assumptions,
        idempotencyKey: state.clientSaveId,
      }),
    });
    state.strategy = data.strategy;
    state.updatedAt = new Date().toISOString();
    state.versions = [
      {
        versionNumber: 1,
        data: data.strategy,
        changeRequest: "İlkin strategiya",
        createdAt: state.updatedAt,
      },
    ];
    trackEvent("strategy_generated", { clarificationRounds: state.round });
    setStatus("ready");
    render();
  } catch (error) {
    setError(error, startGeneration, state.questions.length ? "needs_clarification" : "draft");
  }
}

function calcReadingTime(strategy) {
  if (!strategy) return 3;
  let wordCount = 0;
  if (strategy.title) wordCount += strategy.title.split(/\s+/).length;
  if (strategy.summary) wordCount += strategy.summary.split(/\s+/).length;
  if (strategy.context) {
    Object.values(strategy.context).forEach((val) => {
      if (val) wordCount += String(val).split(/\s+/).length;
    });
  }
  if (Array.isArray(strategy.sections)) {
    strategy.sections.forEach((sec) => {
      if (sec.title) wordCount += sec.title.split(/\s+/).length;
      if (sec.summary) wordCount += sec.summary.split(/\s+/).length;
      if (sec.content) wordCount += sec.content.split(/\s+/).length;
      if (Array.isArray(sec.bullets)) {
        sec.bullets.forEach((b) => (wordCount += String(b).split(/\s+/).length));
      }
    });
  }
  if (Array.isArray(strategy.priorities)) {
    strategy.priorities.forEach((p) => {
      wordCount += `${p.title} ${p.description}`.split(/\s+/).length;
    });
  }
  if (Array.isArray(strategy.actionPlan)) {
    strategy.actionPlan.forEach((ap) => {
      wordCount += `${ap.phase} ${ap.expectedOutcome || ""}`.split(/\s+/).length;
      if (Array.isArray(ap.actions)) {
        ap.actions.forEach((a) => (wordCount += String(a).split(/\s+/).length));
      }
    });
  }
  return Math.max(1, Math.ceil(wordCount / 170));
}

function createSectionHeading(kicker, title, description) {
  const heading = element("div", "section-heading");
  heading.append(element("span", "section-kicker", kicker), element("h2", "", title));
  if (description) heading.append(element("p", "section-description", description));
  return heading;
}

function buildFormatSwitcher() {
  const container = element("div", "strategy-format-tabs");
  container.setAttribute("role", "tablist");
  container.setAttribute("aria-label", "Görünüş formatı");

  const tabs = [
    { id: "blog", label: "Məqalə (Blog)" },
    { id: "faq", label: "Sual-Cavab (FAQ)" },
    { id: "roadmap", label: "İcra Planı" },
  ];

  tabs.forEach((tab) => {
    const btn = button(tab.label, `format-tab${state.strategyFormat === tab.id ? " is-active" : ""}`, () => {
      state.strategyFormat = tab.id;
      render();
    });
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(state.strategyFormat === tab.id));
    container.appendChild(btn);
  });

  return container;
}

function buildStrategyHeader(strategy) {
  const header = element("header", "strategy-overview");
  header.id = "overview";

  const topRow = element("div", "strategy-header-top");
  const status = element("span", `status-badge status-${state.status}`);
  status.append(element("span", "status-dot"), document.createTextNode(STATUS_LABELS[state.status]));

  const meta = element("div", "strategy-meta");
  const readingTime = element("span", "reading-time-badge", `⏱ ~${calcReadingTime(strategy)} dəqiqəlik oxu`);
  meta.append(
    status,
    element("span", "meta-divider", "·"),
    element("span", "", `Versiya ${state.versions.length}`),
    element("span", "meta-divider", "·"),
    element("span", "", `Yenilənib ${formatDate(state.updatedAt)}`),
    element("span", "meta-divider", "·"),
    readingTime,
  );
  topRow.appendChild(meta);

  const title = element("h1", "strategy-title", strategy.title);

  // Context Chips Strip (Auditoriya, Bazar, Büdcə, Biznes)
  const contextChips = element("div", "context-chips-strip");
  if (strategy.context?.targetAudience) {
    const chip = element("div", "context-chip");
    chip.append(element("span", "chip-icon", "🎯"), element("strong", "", "Auditoriya: "), element("span", "", shortValue(strategy.context.targetAudience, 45)));
    contextChips.appendChild(chip);
  }
  if (strategy.context?.market) {
    const chip = element("div", "context-chip");
    chip.append(element("span", "chip-icon", "📍"), element("strong", "", "Bazar: "), element("span", "", shortValue(strategy.context.market, 40)));
    contextChips.appendChild(chip);
  }
  const budget = budgetSignal(state.brief);
  if (budget) {
    const chip = element("div", "context-chip");
    chip.append(element("span", "chip-icon", "💰"), element("strong", "", "Büdcə: "), element("span", "", budget));
    contextChips.appendChild(chip);
  }
  if (strategy.context?.business) {
    const chip = element("div", "context-chip");
    chip.append(element("span", "chip-icon", "🏢"), element("strong", "", "Biznes: "), element("span", "", shortValue(strategy.context.business, 40)));
    contextChips.appendChild(chip);
  }

  // Strateji Xülasə / Executive Brief Box (Clean, single presentation, no duplicate essence text below!)
  const execCard = element("div", "strategy-executive-card");
  const execKicker = element("div", "exec-card-header");
  execKicker.append(
    element("span", "exec-badge", "✦ STRATEJİ XÜLASƏ VƏ ƏSAS İSTİQAMƏT"),
  );
  const execText = element("p", "exec-summary-text", strategy.summary);
  execCard.append(execKicker, execText);

  header.append(topRow, title, contextChips, execCard);

  if (state.changeSummary) {
    const changeBox = element("div", "change-note");
    changeBox.append(element("span", "change-note-icon", "✨ "), document.createTextNode(state.changeSummary));
    header.append(changeBox);
  }

  return header;
}

function buildKpiCard(kpi) {
  const card = element("article", "kpi-card");
  const header = element("div", "kpi-card-header");
  const kicker = element("span", "kpi-card-kicker", "📊 KPI Metriki");
  const name = element("h3", "kpi-name", kpi.name);
  header.append(kicker, name);

  const targetBox = element("div", "kpi-target-box");
  targetBox.append(
    element("span", "kpi-target-label", "Hədəf / İlk Siqnal:"),
    element("p", "kpi-target-value", kpi.target || "İlk ölçüm dövrü"),
  );

  const desc = element("p", "kpi-desc", kpi.reason);
  card.append(header, targetBox, desc);
  return card;
}

function buildBlogView(strategy) {
  const container = element("div", "strategy-blog-container");

  // 01. PRIORİTETLƏR
  const priorities = element("section", "strategy-work-section");
  priorities.id = "priorities";
  priorities.appendChild(createSectionHeading("01. PRİORİTETLƏR", "İlk növbədə nəyə fokuslanırıq?", "Resursların və diqqətin yönəldiləcəyi ən vacib strateji istiqamətlər"));
  const pillarGrid = element("div", "strategy-pillar-grid");
  strategy.priorities.forEach((item, index) => {
    const card = element("article", `strategy-pillar-card priority-${item.priority}`);
    const top = element("div", "pillar-card-top");
    const num = element("span", "pillar-num", String(index + 1).padStart(2, "0"));
    const priorityLabel = item.priority === "high" ? "Yüksək Prioritet" : item.priority === "medium" ? "Orta Prioritet" : "Planlı";
    const badge = element("span", `pillar-badge priority-${item.priority}`, priorityLabel);
    top.append(num, badge);
    const h3 = element("h3", "pillar-title", item.title);
    const p = element("p", "pillar-desc", item.description);
    card.append(top, h3, p);
    pillarGrid.appendChild(card);
  });
  priorities.appendChild(pillarGrid);

  // 02. STRATEJİ QƏRARLAR VƏ YANAŞMA
  const direction = element("section", "strategy-work-section");
  direction.id = "decisions";
  direction.appendChild(createSectionHeading("02. STRATEJİ QƏRARLAR", "Kanal, mövqeləndirmə və hədəf yanaşması", "Məqsədə çatmaq üçün verilmiş əsas qərarlar və tətbiq qaydaları"));
  const sections = element("div", "editorial-sections-list");
  strategy.sections.forEach((section, index) => {
    const article = element("article", "editorial-section-card");
    const header = element("header", "editorial-card-header");
    const num = element("span", "editorial-idx", `02.${index + 1}`);
    const heading = element("h3", "editorial-title", section.title);
    header.append(num, heading);

    const body = element("div", "editorial-card-body");

    // Decision Highlight Callout
    const decisionBox = element("div", "editorial-decision-box");
    decisionBox.append(
      element("strong", "decision-label", "Əsas Qərar:"),
      element("p", "decision-text", section.summary || firstSentences(section.content, 2)),
    );
    body.appendChild(decisionBox);

    // Rationale
    if (section.content) {
      const rationaleBox = element("div", "editorial-rationale-box");
      rationaleBox.append(
        element("span", "rationale-label", "Niyə və necə işləyir?"),
        element("p", "rationale-text", section.content),
      );
      body.appendChild(rationaleBox);
    }

    // Actionable Bullets
    if (section.bullets && section.bullets.length) {
      const actionsBox = element("div", "editorial-actions-box");
      actionsBox.append(element("span", "actions-label", "Tətbiq və İcra Addımları:"));
      const list = element("ul", "editorial-bullets");
      section.bullets.forEach((item) => {
        const li = element("li");
        li.append(element("span", "bullet-check", "✓"), document.createTextNode(item));
        list.appendChild(li);
      });
      actionsBox.appendChild(list);
      body.appendChild(actionsBox);
    }

    article.append(header, body);
    sections.appendChild(article);
  });
  direction.appendChild(sections);

  // 03. İCRA PLANI (Timeline)
  const actionPlan = element("section", "strategy-work-section");
  actionPlan.id = "execution";
  actionPlan.appendChild(createSectionHeading("03. İCRA PLANI", "Mərhələli tətbiq qrafiki", "Strategiyadan konkret nəticələrə doğru addım-addım yol xəritəsi"));
  const timeline = element("div", "roadmap-timeline");
  strategy.actionPlan.forEach((phase, index) => {
    const card = element("article", "roadmap-phase-card");
    const phaseHeader = element("div", "phase-card-header");
    const phaseBadge = element("span", "phase-badge", `Mərhələ ${index + 1}`);
    const phaseTitle = element("h3", "phase-title", phase.phase);
    phaseHeader.append(phaseBadge, phaseTitle);

    const actionList = element("ul", "phase-action-list");
    phase.actions.forEach((action) => {
      const li = element("li");
      li.append(element("span", "action-dot", "•"), document.createTextNode(action));
      actionList.appendChild(li);
    });

    card.append(phaseHeader, actionList);

    if (phase.expectedOutcome) {
      const outcome = element("div", "phase-outcome");
      outcome.append(
        element("span", "outcome-icon", "🎯"),
        element("strong", "", "Gözlənilən nəticə: "),
        document.createTextNode(phase.expectedOutcome),
      );
      card.appendChild(outcome);
    }
    timeline.appendChild(card);
  });
  actionPlan.appendChild(timeline);

  // 04. KPI GÖSTƏRİCİLƏRİ
  const measurement = element("section", "strategy-work-section");
  measurement.id = "kpi";
  measurement.appendChild(createSectionHeading("04. KPI GÖSTƏRİCİLƏRİ", "Ölçü və uğur siqnalları", "Strategiyanın effektivliyini izləmək üçün əsas performans göstəriciləri"));
  const kpiGrid = element("div", "kpi-cards-grid");
  strategy.kpis.forEach((kpi) => {
    kpiGrid.appendChild(buildKpiCard(kpi));
  });
  measurement.appendChild(kpiGrid);

  // 05. RİSKLƏR VƏ HƏLLİ
  const risks = element("section", "strategy-work-section");
  risks.id = "risks";
  risks.appendChild(createSectionHeading("05. RİSKLƏR VƏ HƏLLİ", "Ehtiyat tədbirləri və qarşısının alınması", "Gözlənilməz çətinliklərə qarşı sığorta və həll yolları"));
  const riskGrid = element("div", "risk-cards-grid");
  if (strategy.risks && strategy.risks.length) {
    strategy.risks.forEach((risk, index) => {
      const card = element("article", "risk-card");
      const top = element("div", "risk-card-top");
      const badge = element("span", `risk-badge risk-${index < 2 ? "high" : "medium"}`, index < 2 ? "Yüksək Risk" : "Orta Risk");
      const title = element("h3", "risk-title", risk.risk);
      top.append(badge, title);
      const mitigation = element("div", "risk-mitigation");
      mitigation.append(element("strong", "", "Həll yolu: "), document.createTextNode(risk.mitigation));
      card.append(top, mitigation);
      riskGrid.appendChild(card);
    });
  } else {
    riskGrid.appendChild(element("p", "section-empty", "Əlavə kritik risk müəyyən edilməyib."));
  }
  risks.appendChild(riskGrid);

  // 06. NÖVBƏTİ ADDIMLAR (Checklist)
  const closeout = element("section", "strategy-work-section next-actions-section");
  closeout.id = "next";
  const headingWrapper = element("div", "section-heading-with-action");
  headingWrapper.appendChild(createSectionHeading("06. NÖVBƏTİ ADDIMLAR", "Dərhal başlanılacaq fəaliyyətlər", "Strategiyanı hərəkətə keçirmək üçün ilk addım-addım tapşırıqlar"));

  const addAllToPlannerButton = button("✦ Planlaşdırılanlara əlavə et", "add-to-planner-btn", async () => {
    addAllToPlannerButton.disabled = true;
    addAllToPlannerButton.textContent = "Əlavə edilir…";
    try {
      const itemsToBatch = [];
      const groupLabels = ["Bu gün", "Növbəti 48 saat", "Bu həftə"];
      const chunkSize = Math.max(1, Math.ceil(strategy.nextSteps.length / 3));
      groupLabels.forEach((label, groupIndex) => {
        const items = strategy.nextSteps.slice(groupIndex * chunkSize, (groupIndex + 1) * chunkSize);
        items.forEach((item) => {
          itemsToBatch.push({
            text: item,
            groupLabel: label,
            strategyId: state.savedId || null,
            strategyTitle: strategy.title || "Strategiya",
          });
        });
      });

      const res = await authRequest("/api/planner/batch", {
        method: "POST",
        body: JSON.stringify({ tasks: itemsToBatch }),
      });
      state.plannerTasks = Array.isArray(res.tasks) ? res.tasks : state.plannerTasks;
      updatePlannerBadge();
      showToast(`${res.added?.length || itemsToBatch.length} tapşırıq Planlaşdırılanlara əlavə edildi ✓`, "success");
      addAllToPlannerButton.textContent = "✓ Əlavə edildi";
      setTimeout(() => {
        addAllToPlannerButton.disabled = false;
        addAllToPlannerButton.textContent = "✦ Planlaşdırılanlara əlavə et";
      }, 2500);
    } catch (err) {
      showToast(err.message || "Xəta baş verdi", "error");
      addAllToPlannerButton.disabled = false;
      addAllToPlannerButton.textContent = "✦ Planlaşdırılanlara əlavə et";
    }
  });

  headingWrapper.appendChild(addAllToPlannerButton);
  closeout.appendChild(headingWrapper);

  const checklistGrid = element("div", "action-checklist-grid");
  const groupLabels = ["Bu gün", "Növbəti 48 saat", "Bu həftə"];
  const chunkSize = Math.max(1, Math.ceil(strategy.nextSteps.length / 3));
  groupLabels.forEach((label, groupIndex) => {
    const items = strategy.nextSteps.slice(groupIndex * chunkSize, (groupIndex + 1) * chunkSize);
    if (!items.length) return;
    const groupCard = element("section", "checklist-group-card");
    groupCard.appendChild(element("h3", "checklist-group-title", label));
    const itemsList = element("div", "checklist-items-list");
    items.forEach((item, itemIndex) => {
      const checkboxLabel = element("label", "checklist-item");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.key = `${groupIndex}-${itemIndex}`;
      const span = element("span", "checklist-item-text", item);

      const singleAddBtn = button("+ Planlaşdır", "item-plan-btn", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        singleAddBtn.disabled = true;
        singleAddBtn.textContent = "…";
        try {
          const res = await authRequest("/api/planner", {
            method: "POST",
            body: JSON.stringify({
              text: item,
              groupLabel: label,
              strategyId: state.savedId || null,
              strategyTitle: strategy.title || "Strategiya",
            }),
          });
          if (res.task) {
            state.plannerTasks = [res.task, ...state.plannerTasks.filter((t) => t.id !== res.task.id)];
            updatePlannerBadge();
            showToast("Tapşırıq Planlaşdırılanlara əlavə edildi ✓", "success");
            singleAddBtn.textContent = "✓";
          }
        } catch (err) {
          showToast(err.message || "Xəta baş verdi", "error");
          singleAddBtn.textContent = "+ Planlaşdır";
          singleAddBtn.disabled = false;
        }
      });

      checkboxLabel.append(checkbox, span, singleAddBtn);
      itemsList.appendChild(checkboxLabel);
    });
    groupCard.appendChild(itemsList);
    checklistGrid.appendChild(groupCard);
  });
  closeout.appendChild(checklistGrid);

  // Assumptions
  if (strategy.assumptions && strategy.assumptions.length) {
    const assumptions = document.createElement("details");
    assumptions.className = "assumptions-panel";
    assumptions.appendChild(element("summary", "", "Fərziyyələr və əsas kontekst"));
    const assumptionList = element("ul", "decision-list");
    strategy.assumptions.forEach((item) => assumptionList.appendChild(element("li", "", item)));
    assumptions.append(assumptionList);
    container.append(priorities, direction, actionPlan, measurement, risks, closeout, assumptions);
  } else {
    container.append(priorities, direction, actionPlan, measurement, risks, closeout);
  }

  return container;
}

function buildFaqView(strategy) {
  const container = element("div", "strategy-faq-container");

  const faqHeader = element("div", "faq-intro-header");
  const faqTitle = element("h2", "faq-main-title", "Strategiya haqqında tez-tez verilən suallar və aydın cavablar");
  const faqSubtitle = element("p", "faq-main-desc", "Bütün strateji qərarlar, hədəf auditoriyası, icra mərhələləri və risklər sual-cavab formatında ümumiləşdirilib.");
  faqHeader.append(faqTitle, faqSubtitle);

  // FAQ Controls: Search + Toggle All
  const controlsBar = element("div", "faq-controls-bar");
  const searchInput = element("input", "faq-search-input");
  searchInput.type = "search";
  searchInput.placeholder = "Suallarda axtar...";
  searchInput.value = state.faqFilter || "";
  searchInput.setAttribute("aria-label", "Suallarda axtar");

  const toggleAllBtn = button(
    state.faqExpandedAll ? "Hamısını bağla" : "Hamısını aç",
    "secondary-button compact faq-toggle-btn",
    () => {
      state.faqExpandedAll = !state.faqExpandedAll;
      const detailsList = container.querySelectorAll(".faq-item");
      detailsList.forEach((d) => {
        d.open = state.faqExpandedAll;
      });
      toggleAllBtn.textContent = state.faqExpandedAll ? "Hamısını bağla" : "Hamısını aç";
    },
  );

  controlsBar.append(searchInput, toggleAllBtn);
  container.append(faqHeader, controlsBar);

  // Structured FAQ Q&A Items
  const faqItemsData = [
    {
      id: "faq-goal",
      category: "Məqsəd və Xülasə",
      question: "Bu strategiyanın əsas biznes məqsədi və istiqaməti nədir?",
      renderBody: () => {
        const body = element("div", "faq-body-content");
        body.append(
          element("p", "faq-lead-text", strategy.summary),
        );
        if (strategy.context?.objective) {
          const objBox = element("div", "faq-info-callout");
          objBox.append(element("strong", "", "Hədəflənən Nəticə: "), document.createTextNode(strategy.context.objective));
          body.appendChild(objBox);
        }
        return body;
      },
    },
    {
      id: "faq-audience",
      category: "Auditoriya və Bazar",
      question: "Hədəf auditoriyamız kimlərdir və harada fəaliyyət göstəririk?",
      renderBody: () => {
        const body = element("div", "faq-body-content");
        if (strategy.context?.targetAudience) {
          body.append(element("p", "", `Əsas auditoriya: ${strategy.context.targetAudience}`));
        }
        if (strategy.context?.market) {
          body.append(element("p", "", `Fəaliyyət bazarı və coğrafiya: ${strategy.context.market}`));
        }
        if (strategy.context?.business) {
          body.append(element("p", "", `Biznes modeli və təklif: ${strategy.context.business}`));
        }
        return body;
      },
    },
    {
      id: "faq-priorities",
      category: "Prioritetlər",
      question: "İlk növbədə hansı strateji prioritetləri icra etməliyik?",
      renderBody: () => {
        const body = element("div", "faq-body-content");
        const list = element("div", "faq-priorities-list");
        strategy.priorities.forEach((p, idx) => {
          const item = element("div", "faq-priority-row");
          const tag = element("span", `pillar-badge priority-${p.priority}`, p.priority === "high" ? "Yüksək" : p.priority === "medium" ? "Orta" : "Planlı");
          const text = element("div", "");
          text.append(element("strong", "", `${idx + 1}. ${p.title}: `), document.createTextNode(p.description));
          item.append(tag, text);
          list.appendChild(item);
        });
        body.appendChild(list);
        return body;
      },
    },
    {
      id: "faq-decisions",
      category: "Strateji Qərarlar",
      question: "Marketinq və inkişaf üzrə hansı əsas qərarlar verilib?",
      renderBody: () => {
        const body = element("div", "faq-body-content");
        strategy.sections.forEach((sec, idx) => {
          const secBox = element("div", "faq-decision-entry");
          secBox.append(
            element("h4", "faq-entry-title", `${idx + 1}. ${sec.title}`),
            element("p", "faq-entry-decision", sec.summary || sec.content),
          );
          if (sec.bullets && sec.bullets.length) {
            const ul = element("ul", "editorial-bullets");
            sec.bullets.forEach((b) => {
              const li = element("li");
              li.append(element("span", "bullet-check", "✓"), document.createTextNode(b));
              ul.appendChild(li);
            });
            secBox.appendChild(ul);
          }
          body.appendChild(secBox);
        });
        return body;
      },
    },
    {
      id: "faq-execution",
      category: "İcra Planı",
      question: "İcra planı hansı mərhələlərlə həyata keçiriləcək?",
      renderBody: () => {
        const body = element("div", "faq-body-content");
        const timeline = element("div", "roadmap-timeline");
        strategy.actionPlan.forEach((ph, idx) => {
          const card = element("div", "roadmap-phase-card");
          const h = element("div", "phase-card-header");
          h.append(element("span", "phase-badge", `Mərhələ ${idx + 1}`), element("h3", "phase-title", ph.phase));
          const ul = element("ul", "phase-action-list");
          ph.actions.forEach((act) => {
            const li = element("li");
            li.append(element("span", "action-dot", "•"), document.createTextNode(act));
            ul.appendChild(li);
          });
          card.append(h, ul);
          if (ph.expectedOutcome) {
            const out = element("div", "phase-outcome");
            out.append(element("span", "outcome-icon", "🎯"), element("strong", "", "Gözlənilən nəticə: "), document.createTextNode(ph.expectedOutcome));
            card.appendChild(out);
          }
          timeline.appendChild(card);
        });
        body.appendChild(timeline);
        return body;
      },
    },
    {
      id: "faq-kpi",
      category: "KPI və Nəticə",
      question: "Strategiyanın uğurunu və nəticələrini hansı KPI-larla ölçəcəyik?",
      renderBody: () => {
        const body = element("div", "faq-body-content");
        const kpiGrid = element("div", "kpi-cards-grid");
        strategy.kpis.forEach((kpi) => {
          kpiGrid.appendChild(buildKpiCard(kpi));
        });
        body.appendChild(kpiGrid);
        return body;
      },
    },
    {
      id: "faq-risks",
      category: "Risklər",
      question: "Hansı risklər yarana bilər və onların qarşısını necə alacağıq?",
      renderBody: () => {
        const body = element("div", "faq-body-content");
        const riskGrid = element("div", "risk-cards-grid");
        if (strategy.risks && strategy.risks.length) {
          strategy.risks.forEach((r, idx) => {
            const card = element("article", "risk-card");
            const top = element("div", "risk-card-top");
            top.append(element("span", `risk-badge risk-${idx < 2 ? "high" : "medium"}`, idx < 2 ? "Yüksək Risk" : "Orta Risk"), element("h3", "risk-title", r.risk));
            const mit = element("div", "risk-mitigation");
            mit.append(element("strong", "", "Həll yolu: "), document.createTextNode(r.mitigation));
            card.append(top, mit);
            riskGrid.appendChild(card);
          });
        }
        body.appendChild(riskGrid);
        return body;
      },
    },
    {
      id: "faq-next",
      category: "İlk Addımlar",
      question: "Dərhal (növbəti 24–48 saatda) hansı ilk addımları atmalıyıq?",
      renderBody: () => {
        const body = element("div", "faq-body-content");
        const checklistGrid = element("div", "action-checklist-grid");
        const groupLabels = ["Bu gün", "Növbəti 48 saat", "Bu həftə"];
        const chunkSize = Math.max(1, Math.ceil(strategy.nextSteps.length / 3));
        groupLabels.forEach((label, groupIndex) => {
          const items = strategy.nextSteps.slice(groupIndex * chunkSize, (groupIndex + 1) * chunkSize);
          if (!items.length) return;
          const groupCard = element("section", "checklist-group-card");
          groupCard.appendChild(element("h3", "checklist-group-title", label));
          const itemsList = element("div", "checklist-items-list");
          items.forEach((item, itemIndex) => {
            const checkboxLabel = element("label", "checklist-item");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.dataset.key = `faq-${groupIndex}-${itemIndex}`;
            checkboxLabel.append(checkbox, element("span", "checklist-item-text", item));
            itemsList.appendChild(checkboxLabel);
          });
          groupCard.appendChild(itemsList);
          checklistGrid.appendChild(groupCard);
        });
        body.appendChild(checklistGrid);
        return body;
      },
    },
  ];

  if (strategy.assumptions && strategy.assumptions.length) {
    faqItemsData.push({
      id: "faq-assumptions",
      category: "Fərziyyələr",
      question: "Bu strategiya hansı ilkin fərziyyələrə və şərtlərə əsaslanır?",
      renderBody: () => {
        const body = element("div", "faq-body-content");
        const list = element("ul", "editorial-bullets");
        strategy.assumptions.forEach((item) => {
          const li = element("li");
          li.append(element("span", "bullet-check", "•"), document.createTextNode(item));
          list.appendChild(li);
        });
        body.appendChild(list);
        return body;
      },
    });
  }

  const faqAccordion = element("div", "faq-accordion");

  const renderFilteredFaq = () => {
    faqAccordion.replaceChildren();
    const query = (state.faqFilter || "").trim().toLocaleLowerCase("az");
    const matched = faqItemsData.filter((item) => {
      if (!query) return true;
      return item.question.toLocaleLowerCase("az").includes(query) || item.category.toLocaleLowerCase("az").includes(query);
    });

    if (!matched.length) {
      faqAccordion.appendChild(element("p", "faq-no-results", "Axtarışınıza uyğun sual tapılmadı."));
      return;
    }

    matched.forEach((item, idx) => {
      const details = document.createElement("details");
      details.className = "faq-item";
      details.id = item.id;
      if (state.faqExpandedAll || idx === 0) details.open = true;

      const summary = element("summary", "faq-summary");
      const summaryLeft = element("div", "faq-summary-left");
      summaryLeft.append(
        element("span", "faq-category-badge", item.category),
        element("span", "faq-question-text", item.question),
      );
      const chevron = element("span", "faq-chevron", "›");
      summary.append(summaryLeft, chevron);

      const bodyWrap = element("div", "faq-body-wrap");
      bodyWrap.appendChild(item.renderBody());

      details.append(summary, bodyWrap);
      faqAccordion.appendChild(details);
    });
  };

  searchInput.addEventListener("input", () => {
    state.faqFilter = searchInput.value;
    renderFilteredFaq();
  });

  renderFilteredFaq();
  container.appendChild(faqAccordion);
  return container;
}

function buildRoadmapView(strategy) {
  const container = element("div", "strategy-roadmap-container");

  // Timeline
  const actionPlan = element("section", "strategy-work-section");
  actionPlan.id = "execution";
  actionPlan.appendChild(createSectionHeading("İCRA MƏRHƏLƏLƏRİ", "Strategiyadan hərəkətə", "Hər bir mərhələnin hədəfləri və gözlənilən nəticələri"));
  const timeline = element("div", "roadmap-timeline");
  strategy.actionPlan.forEach((phase, index) => {
    const card = element("article", "roadmap-phase-card");
    const phaseHeader = element("div", "phase-card-header");
    const phaseBadge = element("span", "phase-badge", `Mərhələ ${index + 1}`);
    const phaseTitle = element("h3", "phase-title", phase.phase);
    phaseHeader.append(phaseBadge, phaseTitle);

    const actionList = element("ul", "phase-action-list");
    phase.actions.forEach((action) => {
      const li = element("li");
      li.append(element("span", "action-dot", "•"), document.createTextNode(action));
      actionList.appendChild(li);
    });

    card.append(phaseHeader, actionList);

    if (phase.expectedOutcome) {
      const outcome = element("div", "phase-outcome");
      outcome.append(
        element("span", "outcome-icon", "🎯"),
        element("strong", "", "Gözlənilən nəticə: "),
        document.createTextNode(phase.expectedOutcome),
      );
      card.appendChild(outcome);
    }
    timeline.appendChild(card);
  });
  actionPlan.appendChild(timeline);

  // Next Steps Checklist
  const closeout = element("section", "strategy-work-section next-actions-section");
  closeout.id = "next";
  const headingWrapper = element("div", "section-heading-with-action");
  headingWrapper.appendChild(createSectionHeading("NÖVBƏTİ ADDIMLAR", "Dərhal başlanılacaq fəaliyyətlər", "Strategiyanı hərəkətə keçirmək üçün ilk addımlar"));

  const addAllToPlannerButton = button("✦ Planlaşdırılanlara əlavə et", "add-to-planner-btn", async () => {
    addAllToPlannerButton.disabled = true;
    addAllToPlannerButton.textContent = "Əlavə edilir…";
    try {
      const itemsToBatch = [];
      const groupLabels = ["Bu gün", "Növbəti 48 saat", "Bu həftə"];
      const chunkSize = Math.max(1, Math.ceil(strategy.nextSteps.length / 3));
      groupLabels.forEach((label, groupIndex) => {
        const items = strategy.nextSteps.slice(groupIndex * chunkSize, (groupIndex + 1) * chunkSize);
        items.forEach((item) => {
          itemsToBatch.push({
            text: item,
            groupLabel: label,
            strategyId: state.savedId || null,
            strategyTitle: strategy.title || "Strategiya",
          });
        });
      });

      const res = await authRequest("/api/planner/batch", {
        method: "POST",
        body: JSON.stringify({ tasks: itemsToBatch }),
      });
      state.plannerTasks = Array.isArray(res.tasks) ? res.tasks : state.plannerTasks;
      updatePlannerBadge();
      showToast(`${res.added?.length || itemsToBatch.length} tapşırıq Planlaşdırılanlara əlavə edildi ✓`, "success");
      addAllToPlannerButton.textContent = "✓ Əlavə edildi";
      setTimeout(() => {
        addAllToPlannerButton.disabled = false;
        addAllToPlannerButton.textContent = "✦ Planlaşdırılanlara əlavə et";
      }, 2500);
    } catch (err) {
      showToast(err.message || "Xəta baş verdi", "error");
      addAllToPlannerButton.disabled = false;
      addAllToPlannerButton.textContent = "✦ Planlaşdırılanlara əlavə et";
    }
  });

  headingWrapper.appendChild(addAllToPlannerButton);
  closeout.appendChild(headingWrapper);

  const checklistGrid = element("div", "action-checklist-grid");
  const groupLabels = ["Bu gün", "Növbəti 48 saat", "Bu həftə"];
  const chunkSize = Math.max(1, Math.ceil(strategy.nextSteps.length / 3));
  groupLabels.forEach((label, groupIndex) => {
    const items = strategy.nextSteps.slice(groupIndex * chunkSize, (groupIndex + 1) * chunkSize);
    if (!items.length) return;
    const groupCard = element("section", "checklist-group-card");
    groupCard.appendChild(element("h3", "checklist-group-title", label));
    const itemsList = element("div", "checklist-items-list");
    items.forEach((item, itemIndex) => {
      const checkboxLabel = element("label", "checklist-item");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.key = `roadmap-${groupIndex}-${itemIndex}`;
      const span = element("span", "checklist-item-text", item);

      const singleAddBtn = button("+ Planlaşdır", "item-plan-btn", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        singleAddBtn.disabled = true;
        singleAddBtn.textContent = "…";
        try {
          const res = await authRequest("/api/planner", {
            method: "POST",
            body: JSON.stringify({
              text: item,
              groupLabel: label,
              strategyId: state.savedId || null,
              strategyTitle: strategy.title || "Strategiya",
            }),
          });
          if (res.task) {
            state.plannerTasks = [res.task, ...state.plannerTasks.filter((t) => t.id !== res.task.id)];
            updatePlannerBadge();
            showToast("Tapşırıq Planlaşdırılanlara əlavə edildi ✓", "success");
            singleAddBtn.textContent = "✓";
          }
        } catch (err) {
          showToast(err.message || "Xəta baş verdi", "error");
          singleAddBtn.textContent = "+ Planlaşdır";
          singleAddBtn.disabled = false;
        }
      });

      checkboxLabel.append(checkbox, span, singleAddBtn);
      itemsList.appendChild(checkboxLabel);
    });
    groupCard.appendChild(itemsList);
    checklistGrid.appendChild(groupCard);
  });
  closeout.appendChild(checklistGrid);

  // KPI checkpoints
  const measurement = element("section", "strategy-work-section");
  measurement.id = "kpi";
  measurement.appendChild(createSectionHeading("UĞUR VƏ KPI YOXLAMA NÖQTƏLƏRİ", "Ölçü və hədəf siqnalları"));
  const kpiGrid = element("div", "kpi-cards-grid");
  strategy.kpis.forEach((kpi) => {
    kpiGrid.appendChild(buildKpiCard(kpi));
  });
  measurement.appendChild(kpiGrid);

  container.append(actionPlan, closeout, measurement);
  return container;
}

function renderStrategyWorkspace() {
  workspace.classList.add("workspace-document");
  const strategy = state.strategy;
  const view = element("div", `strategy-view${state.status === "refining" ? " is-refining" : ""}`);

  // Toolbar - Clean Top Navigation with Breadcrumb and Format Switcher
  const toolbar = element("div", "strategy-toolbar");
  const crumb = button(`Arxiv / ${strategy.title}`, "strategy-breadcrumb", () => {
    state.view = "list";
    render();
  });

  const switcher = buildFormatSwitcher();
  toolbar.append(crumb, switcher);

  // Header
  const header = buildStrategyHeader(strategy);

  // Canvas
  const documentCanvas = element("main", "strategy-document-canvas");
  documentCanvas.appendChild(header);

  let tocItems = [];
  if (state.strategyFormat === "faq") {
    documentCanvas.appendChild(buildFaqView(strategy));
    tocItems = [
      ["overview", "Xülasə & Kontekst"],
      ["faq-goal", "Məqsəd"],
      ["faq-audience", "Auditoriya"],
      ["faq-priorities", "Prioritetlər"],
      ["faq-decisions", "Qərarlar"],
      ["faq-execution", "İcra Planı"],
      ["faq-kpi", "KPI Metrikləri"],
      ["faq-risks", "Risklər"],
      ["faq-next", "İlk Addımlar"],
    ];
  } else if (state.strategyFormat === "roadmap") {
    documentCanvas.appendChild(buildRoadmapView(strategy));
    tocItems = [
      ["overview", "Xülasə"],
      ["execution", "Mərhələlər"],
      ["next", "Növbəti Addımlar"],
      ["kpi", "KPI Nöqtələri"],
    ];
  } else {
    documentCanvas.appendChild(buildBlogView(strategy));
    tocItems = [
      ["overview", "Xülasə & Kontekst"],
      ["priorities", "01. Prioritetlər"],
      ["decisions", "02. Strateji Qərarlar"],
      ["execution", "03. İcra Planı"],
      ["kpi", "04. KPI Hədəfləri"],
      ["risks", "05. Risklər və Həlli"],
      ["next", "06. Növbəti Addımlar"],
    ];
  }

  // Sticky TOC
  const toc = element("nav", "strategy-toc");
  toc.setAttribute("aria-label", "Strategiya bölmələri");
  tocItems.forEach(([id, label], index) => {
    const link = element("a", index === 0 ? "is-active" : "", label);
    link.href = `#${id}`;
    toc.appendChild(link);
  });

  const shell = element("div", "strategy-local-shell");
  shell.append(toc, documentCanvas);
  view.append(toolbar, shell, buildRefinementPanel());

  if (state.status === "refining") {
    const working = element("div", "refining-banner");
    working.append(element("span", "inline-spinner"), element("span", "", "Strategiya yenilənir — mövcud versiya ekranda qalır."));
    view.prepend(working);
  }
  const banner = errorBanner();
  if (banner) view.insertBefore(banner, shell);
  workspace.appendChild(view);

  const sectionNodes = tocItems.map(([id]) => document.getElementById(id)).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    [...toc.children].forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`));
  }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.2, 0.6] });
  sectionNodes.forEach((section) => observer.observe(section));
}

function firstSentences(value, count = 2, maxLength = count === 1 ? 180 : 360) {
  const text = String(value || "").trim();
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const summary = sentences.slice(0, count).join(" ").trim();
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 1).trim()}…` : summary;
}

function shortValue(value, max = 28) {
  const text = String(value || "—").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function budgetSignal(brief) {
  const match = String(brief || "").match(/(?:₼|AZN|manat|büdcə)\s*[:：-]?\s*([\d.,]+(?:\s*[–-]\s*[\d.,]+)?)/i)
    || String(brief || "").match(/([\d.,]+(?:\s*[–-]\s*[\d.,]+)?)\s*(?:AZN|₼|manat)/i);
  return match ? `${match[1]} AZN` : "Optimallaşdırılmış";
}

function buildRefinementPanel() {
  const panel = element("section", "refinement-dock");
  panel.setAttribute("aria-label", "Strategiyanı idarə et və yenilə");

  // Top Action Buttons Strip: Dəyişiklik istə, İxrac, Yadda saxla
  const actionsStrip = element("div", "dock-actions-strip");

  // 1. Refine button with minimalist pencil/wand icon
  const refineBtn = button("", "dock-action-btn dock-refine-btn", () => {
    const input = document.querySelector("#refinementInput");
    input?.focus();
  });
  refineBtn.innerHTML = `
    <svg class="dock-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>
    </svg>
    <span>Dəyişiklik istə</span>
  `;

  // 2. Export wrap + button with minimalist download/export icon + menu
  const exportWrap = element("div", "export-wrap dock-export-wrap");
  const exportBtn = button("", "dock-action-btn dock-export-btn");
  exportBtn.setAttribute("aria-haspopup", "menu");
  exportBtn.setAttribute("aria-expanded", "false");
  exportBtn.innerHTML = `
    <svg class="dock-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>İxrac</span>
  `;
  const menu = buildExportMenu(exportBtn);
  exportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle("is-open");
    exportBtn.setAttribute("aria-expanded", String(open));
  });
  exportWrap.append(exportBtn, menu);

  // Close export menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!exportWrap.contains(e.target)) {
      menu.classList.remove("is-open");
      exportBtn.setAttribute("aria-expanded", "false");
    }
  });

  // 3. Save button with minimalist bookmark/check icon
  const saveBtn = button("", `dock-action-btn dock-save-btn${state.savedId ? " is-saved" : ""}`, saveStrategy);
  saveBtn.disabled = Boolean(state.savedId) || state.status === "refining";
  const saveIconSvg = state.savedId
    ? `<polyline points="20 6 9 17 4 12"/>`
    : `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>`;
  saveBtn.innerHTML = `
    <svg class="dock-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
      ${saveIconSvg}
    </svg>
    <span>${state.savedId ? "Yadda saxlanıb" : "Yadda saxla"}</span>
  `;

  actionsStrip.append(refineBtn, exportWrap, saveBtn);

  // Middle: Quick suggestions
  const quick = element("div", "quick-actions");
  QUICK_ACTIONS.forEach(([action, label]) => {
    const actionButton = button(label, "quick-action", () => requestRefinement(action, ""));
    actionButton.disabled = state.status === "refining";
    quick.appendChild(actionButton);
  });

  // Bottom: Refinement input form
  const form = element("form", "refinement-form");
  const label = element("label", "sr-only", "Dəyişiklik istəyi");
  label.htmlFor = "refinementInput";
  const input = element("textarea", "refinement-input");
  input.id = "refinementInput";
  input.rows = 1;
  input.maxLength = 2000;
  input.placeholder = "Strategiyada nəyi dəyişmək istəyirsən?";
  input.disabled = state.status === "refining";
  const submit = button("", "refine-submit");
  submit.type = "submit";
  submit.disabled = true;
  submit.setAttribute("aria-label", "Dəyişiklik istəyini göndər");
  submit.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
  form.append(label, input, submit);

  input.addEventListener("input", () => {
    submit.disabled = input.value.trim().length < 3 || state.status === "refining";
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && window.innerWidth > 700) {
      event.preventDefault();
      if (!submit.disabled) form.requestSubmit();
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const request = input.value.trim();
    if (request.length >= 3) requestRefinement("custom", request);
  });

  panel.append(actionsStrip, quick, form);
  return panel;
}

async function requestRefinement(action, request) {
  const previousStatus = state.savedId ? "saved" : "ready";
  clearError();
  state.changeSummary = "";
  trackEvent("refinement_requested", { action, saved: Boolean(state.savedId) });
  if (action !== "custom") trackEvent("quick_action_used", { action });
  setStatus("refining");
  render();
  const path = state.savedId ? `/api/strategy/${state.savedId}/refine` : "/api/strategy/refine";
  try {
    const data = await api(path, {
      method: "POST",
      body: JSON.stringify({
        brief: state.brief,
        answers: state.answers,
        strategy: state.strategy,
        action,
        request,
      }),
    });
    const record = data.strategy;
    state.strategy = record.strategy || record;
    state.updatedAt = record.updatedAt || new Date().toISOString();
    if (record.versions) {
      state.versions = record.versions;
    } else {
      state.versions.push({
        versionNumber: state.versions.length + 1,
        data: state.strategy,
        changeRequest: request || action,
        createdAt: state.updatedAt,
      });
    }
    const actionLabel = QUICK_ACTIONS.find(([id]) => id === action)?.[1];
    state.changeSummary = `Yeniləndi — ${actionLabel || "istədiyin dəyişiklik"} strategiyanın əlaqəli hissələrinə tətbiq olundu.`;
    setStatus(state.savedId ? "saved" : "ready");
    render();
    showToast("Yeni strategiya versiyası hazırdır.");
    if (state.savedId) loadSavedStrategies();
  } catch (error) {
    setError(error, () => requestRefinement(action, request), previousStatus);
  }
}

async function saveStrategy() {
  if (state.savedId || !state.strategy) return;
  try {
    const data = await api("/api/strategy/save", {
      method: "POST",
      body: JSON.stringify({
        clientSaveId: state.clientSaveId,
        brief: state.brief,
        answers: state.answers,
        strategy: state.strategy,
        versions: state.versions,
      }),
    });
    state.savedId = data.strategy.id;
    state.updatedAt = data.strategy.updatedAt;
    state.versions = data.strategy.versions;
    setStatus("saved");
    trackEvent("strategy_saved", { versionCount: state.versions.length });
    render();
    showToast("Strategiya workspace-ə əlavə edildi.");
    await loadSavedStrategies();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function buildExportMenu(trigger) {
  const menu = element("div", "export-menu");
  menu.setAttribute("role", "menu");
  const title = element("span", "export-label", "İxrac et");
  menu.appendChild(title);

  const pdf = button("PDF sənədi (.pdf)", "export-option", () => {
    trackEvent("export_requested", { format: "pdf" });
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    showToast("PDF generasiya edilir və açılır…");
    exportStrategyToPDF(state.strategy);
  });

  const doc = button("HTML sənədi (.html)", "export-option", () => {
    trackEvent("export_requested", { format: "document" });
    downloadExport(createDocumentExport(state.strategy));
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  });

  const csv = button("CSV / Cədvəl (.csv)", "export-option", () => {
    trackEvent("export_requested", { format: "spreadsheet" });
    downloadExport(createSpreadsheetExport(state.strategy));
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  });

  menu.append(pdf, doc, csv, element("div", "export-separator"), element("span", "export-label", "İnteqrasiyalar"));
  ["Google Docs", "Google Sheets"].forEach((label) => {
    const option = element("div", "export-integration");
    option.append(element("span", "", label), element("small", "", "Coming soon"));
    menu.appendChild(option);
  });
  return menu;
}

function downloadExport(file) {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(state.strategy.title)}.${file.extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Export faylı hazırdır.");
}

async function loadSavedStrategies() {
  try {
    const data = await api("/api/strategy");
    state.savedStrategies = data.strategies;
    strategyCount.textContent = String(data.strategies.length);
    renderRecentList();
    if (state.mode === "ask") render();
    else if (state.view === "list") renderStrategyList();
  } catch {
    recentList.replaceChildren(element("p", "recent-empty", "Strategiyaları yükləmək mümkün olmadı."));
  }
}

async function loadSavedChats() {
  try {
    const data = await api("/api/ask/chats");
    state.savedChats = data.chats || [];
    renderRecentList();
  } catch (error) {
    console.error("Failed to load chats:", error);
  }
}

async function openSavedChat(chatId) {
  try {
    const data = await api(`/api/ask/chats/${chatId}`);
    if (!data.chat) return;
    state.mode = "ask";
    state.view = "home";
    state.askChatId = data.chat.id;
    state.askMessages = data.chat.messages || [];
    state.askStrategyId = data.chat.strategyId || "";
    state.askError = "";
    syncMode();
    syncNav();
    render();
    closeSidebar();
  } catch (error) {
    showToast("Söhbəti yükləmək mümkün olmadı.", "error");
  }
}

async function deleteSavedChat(event, chatId) {
  event.stopPropagation();
  try {
    await api(`/api/ask/chats/${chatId}`, { method: "DELETE" });
    if (state.askChatId === chatId) {
      startNewChat();
    }
    await loadSavedChats();
    showToast("Söhbət silindi.");
  } catch (error) {
    showToast("Söhbəti silmək mümkün olmadı.", "error");
  }
}

function renderRecentList() {
  recentList.replaceChildren();

  if (state.mode === "ask") {
    if (!state.savedChats.length) {
      const empty = element("div", "recent-empty");
      empty.append(
        element("strong", "", "Söhbətlər burada görünəcək."),
        element("span", "", "Marketify Ask ilə apardığın söhbətlər burada saxlanılır.")
      );
      recentList.appendChild(empty);
      return;
    }

    state.savedChats.forEach((chat) => {
      const item = button("", "recent-item", () => openSavedChat(chat.id));
      item.classList.toggle("is-active", state.askChatId === chat.id);

      const icon = element("span", "recent-icon-wrap");
      icon.innerHTML = `<svg class="recent-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

      const textWrap = element("div", "recent-text-wrap");
      textWrap.append(
        element("span", "recent-title", chat.title || "Söhbət"),
        element("span", "recent-date", formatDate(chat.updatedAt || chat.createdAt))
      );

      const deleteBtn = button("", "recent-delete-btn", (e) => deleteSavedChat(e, chat.id));
      deleteBtn.setAttribute("aria-label", "Söhbəti sil");
      deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

      item.append(icon, textWrap, deleteBtn);
      recentList.appendChild(item);
    });
    return;
  }

  if (!state.savedStrategies.length) {
    const empty = element("div", "recent-empty");
    empty.append(element("strong", "", "Strategiyalar burada görünəcək."), element("span", "", "Yadda saxladığın işlər bu bölmədə qalır."));
    recentList.appendChild(empty);
    return;
  }
  state.savedStrategies.slice(0, 6).forEach((record) => {
    const item = button("", "recent-item", () => openSavedStrategy(record.id));
    item.classList.toggle("is-active", state.savedId === record.id);

    const icon = element("span", "recent-icon-wrap");
    icon.innerHTML = `<svg class="recent-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;

    const textWrap = element("div", "recent-text-wrap");
    textWrap.append(element("span", "recent-title", record.title), element("span", "recent-date", formatDate(record.updatedAt)));

    item.append(icon, textWrap);
    recentList.appendChild(item);
  });
}

function updateWorkspaceIdentity(user) {
  state.currentUser = user;
  if (!user) {
    workspaceAvatar.textContent = "M";
    workspaceName.textContent = "Marketify workspace";
    workspaceMeta.textContent = "Hesabsız istifadə · hesab yaratmaq tövsiyə olunur";
    return;
  }
  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("az"))
    .join("") || "M";
  workspaceAvatar.textContent = initials;
  workspaceName.textContent = user.fullName;
  workspaceMeta.textContent = `@${user.username} · Şəxsi hesab`;
}

function settingsField(label, name, value, type = "text", autocomplete = "off") {
  const wrapper = element("label", "settings-field");
  const input = element("input", "settings-input");
  input.name = name;
  input.type = type;
  input.value = value || "";
  input.autocomplete = autocomplete;
  input.setAttribute("aria-label", label);
  wrapper.append(element("span", "", label), input);
  return wrapper;
}

function settingsMessage(form, message, tone = "error") {
  let node = form.querySelector(".settings-form-message");
  if (!node) {
    node = element("p", "settings-form-message");
    form.prepend(node);
  }
  node.className = `settings-form-message is-${tone}`;
  node.textContent = message;
}

function renderSettings() {
  workspace.classList.add("workspace-settings");
  workspace.replaceChildren();
  const view = element("section", "settings-view");
  const header = element("header", "settings-header");
  header.append(element("span", "section-kicker", "WORKSPACE"), element("h1", "", state.currentUser ? "Parametrlər" : "Gedişatını qoruyun"), element("p", "", state.currentUser ? "Hesab məlumatlarını və giriş təhlükəsizliyini idarə et." : "Hesabsız istifadə edə bilərsən. Hesab yaratdıqda bu cihazdakı strategiyaların profilinə köçürüləcək və başqa cihazlardan da əlçatan olacaq."));
  if (!state.currentUser) {
    const panel = element("section", "settings-panel guest-account-panel");
    panel.append(
      element("h2", "", "Hesab məcburi deyil"),
      element("p", "settings-panel-intro", "Hazırkı işlərin bu brauzerdə saxlanılır. Cihaz dəyişdikdə itirməmək üçün pulsuz hesab yaratmağı tövsiyə edirik."),
    );
    const actions = element("div", "guest-account-actions");
    actions.append(
      button("Hesab yarat", "primary-button", () => { window.location.href = "/signup?returnTo=/"; }),
      button("Daxil ol", "secondary-button", () => { window.location.href = "/login?returnTo=/"; }),
    );
    panel.appendChild(actions);
    view.append(header, panel);
    workspace.appendChild(view);
    return;
  }
  const tabs = element("div", "settings-tabs");
  const accountTab = button("Hesab", `settings-tab${state.settingsTab === "account" ? " is-active" : ""}`, () => {
    state.settingsTab = "account";
    renderSettings();
  });
  const securityTab = button("Təhlükəsizlik", `settings-tab${state.settingsTab === "security" ? " is-active" : ""}`, () => {
    state.settingsTab = "security";
    renderSettings();
  });
  const legalTab = button("Hüquqi & Məxfilik", `settings-tab${state.settingsTab === "legal" ? " is-active" : ""}`, () => {
    state.settingsTab = "legal";
    renderSettings();
  });
  tabs.append(accountTab, securityTab, legalTab);
  view.append(header, tabs);

  if (state.settingsTab === "account") {
    const panel = element("section", "settings-panel");
    panel.append(element("h2", "", "Hesab məlumatları"), element("p", "settings-panel-intro", "Workspace-də görünən adını və giriş məlumatlarını yenilə."));
    const form = element("form", "settings-form");
    form.append(
      settingsField("Ad və soyad", "fullName", state.currentUser.fullName, "text", "name"),
      settingsField("İstifadəçi adı", "username", state.currentUser.username, "text", "username"),
      settingsField("E-poçt", "email", state.currentUser.email, "email", "email"),
    );
    const save = button("Dəyişiklikləri saxla", "primary-button");
    save.type = "submit";
    form.appendChild(save);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      save.disabled = true;
      save.textContent = "Saxlanılır…";
      try {
        const data = await authRequest("/api/auth/account", {
          method: "PATCH",
          body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        updateWorkspaceIdentity(data.user);
        settingsMessage(form, "Hesab məlumatları yeniləndi.", "success");
      } catch (error) {
        settingsMessage(form, error.message);
      } finally {
        save.disabled = false;
        save.textContent = "Dəyişiklikləri saxla";
      }
    });
    panel.appendChild(form);
    view.appendChild(panel);
  } else if (state.settingsTab === "security") {
    const panel = element("section", "settings-panel");
    panel.append(element("h2", "", "Şifrə və sessiyalar"), element("p", "settings-panel-intro", "Şifrəni dəyişdikdə bu cihazdan başqa bütün aktiv sessiyalar bağlanacaq."));
    const form = element("form", "settings-form");
    form.append(
      settingsField("Cari şifrə", "currentPassword", "", "password", "current-password"),
      settingsField("Yeni şifrə", "newPassword", "", "password", "new-password"),
      settingsField("Yeni şifrəni təsdiqlə", "confirmNewPassword", "", "password", "new-password"),
    );
    const save = button("Şifrəni dəyiş", "primary-button");
    save.type = "submit";
    form.appendChild(save);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.newPassword.value !== form.confirmNewPassword.value) {
        settingsMessage(form, "Yeni şifrələr eyni deyil.");
        return;
      }
      save.disabled = true;
      save.textContent = "Yenilənir…";
      try {
        await authRequest("/api/auth/change-password", {
          method: "POST",
          body: JSON.stringify({
            currentPassword: form.currentPassword.value,
            newPassword: form.newPassword.value,
          }),
        });
        form.reset();
        settingsMessage(form, "Şifrə yeniləndi. Digər sessiyalar bağlandı.", "success");
      } catch (error) {
        settingsMessage(form, error.message);
      } finally {
        save.disabled = false;
        save.textContent = "Şifrəni dəyiş";
      }
    });
    const signOut = element("div", "settings-signout");
    const copy = element("div");
    copy.append(element("strong", "", "Bu cihazdan çıx"), element("p", "", "Marketify sessiyanı təhlükəsiz şəkildə bağlayacaq."));
    signOut.append(copy, button("Hesabdan çıx", "danger-button", logout));
    panel.append(form, signOut);
    view.appendChild(panel);
  } else {
    const panel = element("section", "settings-panel");
    panel.append(
      element("h2", "", "Hüquqi Şərtlər və Məxfilik"),
      element("p", "settings-panel-intro", "Platformanın istifadə qaydaları və 3-cü tərəf süni intellekt API şərtləri ilə tanış ol.")
    );

    const apiNotice = element("div", "legal-highlight-box");
    apiNotice.innerHTML = "<strong>✦ 3-cü Tərəf Süni İntellekt API İnteqrasiyası</strong>Marketify AI xidməti biznes analizləri və strategiya generasiyası üçün qabaqcıl 3-cü tərəf süni intellekt API provayderlərinin (OpenAI, Google) infrastrukturundan istifadə edir.";
    panel.appendChild(apiNotice);

    const docsList = element("div", "settings-legal-list");
    
    const termsRow = element("div", "settings-legal-row");
    const termsInfo = element("div");
    termsInfo.append(element("strong", "", "İstifadə Şərtləri"), element("p", "", "Xidmətdən istifadə qaydaları, hüquqlar və öhdəliklər."));
    termsRow.append(termsInfo, button("Baxış keçir →", "secondary-button", () => openLegalModal("terms")));

    const privacyRow = element("div", "settings-legal-row");
    const privacyInfo = element("div");
    privacyInfo.append(element("strong", "", "Məxfilik Siyasəti"), element("p", "", "Məlumatların emalı, qorunması və 3-cü tərəf API şəffaflığı."));
    privacyRow.append(privacyInfo, button("Baxış keçir →", "secondary-button", () => openLegalModal("privacy")));

    docsList.append(termsRow, privacyRow);
    panel.appendChild(docsList);
    view.appendChild(panel);
  }
  workspace.appendChild(view);
}

function renderStrategyList() {
  workspace.classList.add("workspace-list");
  workspace.replaceChildren();
  const view = element("section", "strategies-view");
  const heading = element("div", "list-heading");
  const copy = element("div");
  copy.append(element("span", "section-kicker", "WORKSPACE"), element("h1", "", "Arxiv"), element("p", "", "Yadda saxladığın bütün strategiyalar və işlər."));
  heading.append(copy, button("＋ Yeni strategiya", "primary-button", resetStrategy));
  view.appendChild(heading);

  if (!state.savedStrategies.length) {
    const empty = element("div", "empty-state");
    empty.append(
      element("span", "empty-icon", "✦"),
      element("h2", "", "Arxivdə hələ heç nə yoxdur"),
      element("p", "", "İlk strategiyanı qur və yadda saxla."),
      button("Yeni strategiya", "primary-button", resetStrategy),
    );
    view.appendChild(empty);
  } else {
    const controls = element("div", "library-controls");
    const search = element("input", "library-search");
    search.type = "search";
    search.placeholder = "Arxivdə axtar";
    search.setAttribute("aria-label", "Arxivdə axtar");
    const filters = element("div", "library-filters");
    ["Hamısı", "Son", "Yadda saxlanmış"].forEach((label, index) => filters.appendChild(button(label, `library-filter${index === 0 ? " is-active" : ""}`)));
    const sort = element("span", "library-sort", "Son yenilənən ↓");
    controls.append(search, filters, sort);
    const list = element("div", "strategy-library");
    const drawRows = () => {
      const query = search.value.trim().toLocaleLowerCase("az");
      const records = state.savedStrategies.filter((record) => !query || `${record.title} ${record.strategy?.summary || record.brief}`.toLocaleLowerCase("az").includes(query));
      list.replaceChildren();
      if (!records.length) {
        list.appendChild(element("p", "library-no-results", "Bu axtarışa uyğun strategiya tapılmadı."));
        return;
      }
      records.forEach((record) => {
        const row = element("article", "strategy-library-row");
        const main = element("div", "library-row-main");
        main.append(element("h2", "", record.title), element("p", "", firstSentences(record.strategy?.summary || record.brief, 1)));
        const meta = element("div", "library-row-meta");
        meta.append(element("span", "", `Yenilənib ${formatDate(record.updatedAt)}`), element("span", "", `Versiya ${record.versionCount}`));
        const status = element("span", "saved-status", "Hazırdır");
        const open = button("Aç →", "text-button", () => openSavedStrategy(record.id));
        row.append(main, meta, status, open);
        list.appendChild(row);
      });
    };
    search.addEventListener("input", drawRows);
    [...filters.children].forEach((filter) => filter.addEventListener("click", () => {
      [...filters.children].forEach((item) => item.classList.toggle("is-active", item === filter));
    }));
    drawRows();
    view.append(controls, list);
  }
  workspace.appendChild(view);
}

async function openSavedStrategy(id) {
  try {
    const data = await api(`/api/strategy/${id}`);
    const record = data.strategy;
    Object.assign(state, {
      view: "home",
      status: "saved",
      brief: record.brief,
      questions: [],
      clarificationIndex: 0,
      clarificationDrafts: {},
      answers: record.clarification?.answers || [],
      assumptions: record.strategy.assumptions,
      strategy: record.strategy,
      versions: record.versions,
      savedId: record.id,
      updatedAt: record.updatedAt,
      error: null,
      retry: null,
      changeSummary: "",
    });
    render();
    closeSidebar();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadPlannerTasks() {
  try {
    const data = await authRequest("/api/planner");
    state.plannerTasks = Array.isArray(data.tasks) ? data.tasks : [];
    updatePlannerBadge();
    if (state.view === "planner") render();
  } catch (error) {
    console.error("Failed to load planner tasks:", error);
  }
}

function updatePlannerBadge() {
  if (plannerCount) {
    const activeCount = state.plannerTasks.filter((t) => !t.completed).length;
    plannerCount.textContent = String(activeCount);
  }
}

function renderPlannerView() {
  workspace.classList.add("workspace-list");
  workspace.replaceChildren();

  const view = element("section", "planner-view");

  // Header Row with 3D Calendar Hero Badge
  const headerRow = element("header", "planner-header-row");
  const headerText = element("div", "planner-header-text");
  headerText.append(
    element("span", "section-kicker", "WORKSPACE"),
    element("h1", "", "Planlaşdırılanlar"),
    element("p", "", "Strategiyalardan əlavə etdiyin və şəxsi tapşırıqlarının icra planı.")
  );

  const heroCard = element("div", "planner-hero-card");
  heroCard.setAttribute("aria-hidden", "true");
  heroCard.innerHTML = `
    <div class="planner-hero-glow"></div>
    <div class="planner-hero-dot dot-1"></div>
    <div class="planner-hero-dot dot-2"></div>
    <div class="planner-hero-icon-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="4" fill="#eff6ff" stroke="#2563eb" stroke-width="1.8"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="#2563eb" stroke-width="2"/>
        <line x1="8" y1="2" x2="8" y2="6" stroke="#2563eb" stroke-width="2"/>
        <line x1="3" y1="10" x2="21" y2="10" stroke="#2563eb" stroke-width="1.6"/>
        <polyline points="9 15 11 17 15 13" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
  headerRow.append(headerText, heroCard);
  view.appendChild(headerRow);

  // Quick Add Composer Card
  const composer = element("form", "planner-composer-card");
  const taskInput = element("input", "planner-composer-input");
  taskInput.type = "text";
  taskInput.placeholder = "Yeni tapşırıq yaz və əlavə et…";
  taskInput.required = true;

  const composerBottom = element("div", "planner-composer-bottom");

  const selectPill = element("div", "planner-time-select-pill");
  const selectLabel = element("span", "planner-select-label", "Bu gün");
  const groupSelect = document.createElement("select");
  groupSelect.className = "planner-select-native";
  ["Bu gün", "Növbəti 48 saat", "Bu həftə", "Ümumi"].forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    groupSelect.appendChild(option);
  });
  groupSelect.addEventListener("change", () => {
    selectLabel.textContent = groupSelect.value;
  });

  selectPill.innerHTML = `
    <svg class="planner-cal-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  `;
  selectPill.appendChild(selectLabel);
  selectPill.appendChild(groupSelect);

  const chevronSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevronSvg.setAttribute("class", "planner-chevron-icon");
  chevronSvg.setAttribute("viewBox", "0 0 24 24");
  chevronSvg.setAttribute("width", "12");
  chevronSvg.setAttribute("height", "12");
  chevronSvg.setAttribute("fill", "none");
  chevronSvg.setAttribute("stroke", "currentColor");
  chevronSvg.setAttribute("stroke-width", "2");
  chevronSvg.setAttribute("stroke-linecap", "round");
  chevronSvg.setAttribute("stroke-linejoin", "round");
  chevronSvg.innerHTML = `<polyline points="6 9 12 15 18 9"/>`;
  selectPill.appendChild(chevronSvg);

  const submitBtn = button("＋ Əlavə et", "planner-submit-btn");
  submitBtn.type = "submit";

  composerBottom.append(selectPill, submitBtn);
  composer.append(taskInput, composerBottom);

  composer.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) return;
    submitBtn.disabled = true;
    try {
      const res = await authRequest("/api/planner", {
        method: "POST",
        body: JSON.stringify({
          text,
          groupLabel: groupSelect.value,
        }),
      });
      if (res.task) {
        state.plannerTasks.unshift(res.task);
        updatePlannerBadge();
        taskInput.value = "";
        drawPlannerList();
        showToast("Tapşırıq əlavə edildi ✓", "success");
      }
    } catch (err) {
      showToast(err.message || "Xəta baş verdi", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });
  view.appendChild(composer);

  // Search Bar
  const searchBar = element("div", "planner-search-bar");
  searchBar.innerHTML = `
    <svg class="planner-search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  `;
  const searchInput = element("input", "planner-search-input");
  searchInput.type = "search";
  searchInput.placeholder = "Tapşırıqlarda axtar…";
  searchInput.setAttribute("aria-label", "Tapşırıqlarda axtar");
  searchBar.appendChild(searchInput);
  view.appendChild(searchBar);

  // Filter Pills Row
  const filterRow = element("div", "planner-filter-row");
  const filterPills = element("div", "planner-filter-pills");
  const filterOptions = [
    { key: "all", label: "Hamısı" },
    { key: "active", label: "Aktiv" },
    { key: "completed", label: "Tamamlanmış" },
  ];
  filterOptions.forEach((opt) => {
    const btn = button(opt.label, `planner-filter-pill${state.plannerFilter === opt.key ? " is-active" : ""}`, () => {
      state.plannerFilter = opt.key;
      [...filterPills.children].forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      drawPlannerList();
    });
    filterPills.appendChild(btn);
  });
  filterRow.appendChild(filterPills);
  view.appendChild(filterRow);

  const listContainer = element("div", "planner-tasks-container");
  view.appendChild(listContainer);

  const drawPlannerList = () => {
    const query = searchInput.value.trim().toLocaleLowerCase("az");
    let tasks = state.plannerTasks;

    if (state.plannerFilter === "active") tasks = tasks.filter((t) => !t.completed);
    else if (state.plannerFilter === "completed") tasks = tasks.filter((t) => t.completed);

    if (query) {
      tasks = tasks.filter((t) =>
        t.text.toLocaleLowerCase("az").includes(query) ||
        (t.strategyTitle && t.strategyTitle.toLocaleLowerCase("az").includes(query)) ||
        (t.groupLabel && t.groupLabel.toLocaleLowerCase("az").includes(query))
      );
    }

    listContainer.replaceChildren();

    if (!tasks.length) {
      const empty = element("div", "empty-state");
      empty.append(
        element("span", "empty-icon", "✓"),
        element("h2", "", state.plannerTasks.length ? "Bu filtrə uyğun tapşırıq tapılmadı" : "Planlaşdırılan tapşırıq yoxdur"),
        element("p", "", "Strategiyaların 'Növbəti addımlar' bölməsindən bir kliklə tapşırıq əlavə edə və ya yuxarıdan yeni tapşırıq yaza bilərsən.")
      );
      listContainer.appendChild(empty);
      return;
    }

    // Group by groupLabel
    const groupOrder = ["Bu gün", "Növbəti 48 saat", "Bu həftə", "Ümumi"];
    const groups = {};
    tasks.forEach((task) => {
      const g = task.groupLabel || "Ümumi";
      if (!groups[g]) groups[g] = [];
      groups[g].push(task);
    });

    const sortedGroupNames = Object.keys(groups).sort((a, b) => {
      const ia = groupOrder.indexOf(a);
      const ib = groupOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    sortedGroupNames.forEach((groupName) => {
      const groupTasks = groups[groupName];
      if (!groupTasks.length) return;

      const groupEl = element("div", "planner-group");
      const groupHeader = element("div", "planner-group-header");
      const activeCount = groupTasks.filter((t) => !t.completed).length;
      groupHeader.append(
        element("h3", "planner-group-name", groupName.toUpperCase()),
        element("span", "planner-group-badge", `${activeCount} aktiv`)
      );
      groupEl.appendChild(groupHeader);

      const taskList = element("div", "planner-task-list");
      groupTasks.forEach((task) => {
        const card = element("div", `planner-task-card${task.completed ? " is-done" : ""}`);

        const cardTop = element("div", "planner-card-top");

        // Custom checkbox
        const checkWrap = element("label", "planner-check-wrap");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(task.completed);
        checkbox.addEventListener("change", async () => {
          task.completed = checkbox.checked;
          card.classList.toggle("is-done", task.completed);
          updatePlannerBadge();
          try {
            await authRequest(`/api/planner/${task.id}`, {
              method: "PATCH",
              body: JSON.stringify({ completed: task.completed }),
            });
          } catch (err) {
            checkbox.checked = !task.completed;
            task.completed = checkbox.checked;
            card.classList.toggle("is-done", task.completed);
            updatePlannerBadge();
            showToast(err.message || "Yeniləmək mümkün olmadı", "error");
          }
        });
        const customBox = element("span", "planner-custom-checkbox");
        checkWrap.append(checkbox, customBox);

        const textEl = element("p", "planner-task-text", task.text);

        const menuWrap = element("div", "planner-menu-wrap");
        const menuBtn = button("", "planner-menu-btn", (e) => {
          e.stopPropagation();
          const existingMenu = menuWrap.querySelector(".planner-dropdown-menu");
          document.querySelectorAll(".planner-dropdown-menu").forEach((m) => m.remove());
          if (existingMenu) return;

          const dropdown = element("div", "planner-dropdown-menu");
          const deleteItem = button("", "planner-dropdown-item is-danger", async (ev) => {
            ev.stopPropagation();
            dropdown.remove();
            if (!window.confirm("Bu tapşırığı silmək istədiyinizdən əminsiniz?")) {
              return;
            }
            card.style.opacity = "0.4";
            try {
              await authRequest(`/api/planner/${task.id}`, { method: "DELETE" });
              state.plannerTasks = state.plannerTasks.filter((t) => t.id !== task.id);
              updatePlannerBadge();
              drawPlannerList();
              showToast("Tapşırıq silindi ✓", "info");
            } catch (err) {
              card.style.opacity = "1";
              showToast(err.message || "Silmək mümkün olmadı", "error");
            }
          });
          deleteItem.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>Sil</span>
          `;
          dropdown.appendChild(deleteItem);
          menuWrap.appendChild(dropdown);
        });

        menuBtn.setAttribute("aria-label", "Əməliyyatlar");
        menuBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <circle cx="12" cy="5" r="1.8"/>
            <circle cx="12" cy="12" r="1.8"/>
            <circle cx="12" cy="19" r="1.8"/>
          </svg>
        `;
        menuWrap.appendChild(menuBtn);

        cardTop.append(checkWrap, textEl, menuWrap);

        const cardBottom = element("div", "planner-card-bottom");
        if (task.strategyTitle) {
          const stratChip = button("", "planner-strategy-chip", () => {
            if (task.strategyId) openSavedStrategy(task.strategyId);
            else {
              state.mode = "build";
              state.view = "list";
              render();
            }
          });
          stratChip.innerHTML = `
            <span class="planner-chip-star">✦</span>
            <span class="planner-chip-title">${task.strategyTitle}</span>
          `;
          cardBottom.appendChild(stratChip);
        } else {
          cardBottom.appendChild(element("div"));
        }

        const timeText = element("span", "planner-time-text");
        timeText.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          ${formatTimeOnly(task.createdAt)}
        `;
        cardBottom.appendChild(timeText);

        card.append(cardTop, cardBottom);
        taskList.appendChild(card);
      });

      groupEl.appendChild(taskList);
      listContainer.appendChild(groupEl);
    });
  };

  const onDocClick = (e) => {
    if (!e.target.closest(".planner-menu-wrap")) {
      document.querySelectorAll(".planner-dropdown-menu").forEach((m) => m.remove());
    }
  };
  document.addEventListener("click", onDocClick, { once: false });

  searchInput.addEventListener("input", drawPlannerList);
  drawPlannerList();
  workspace.appendChild(view);
}

const LEGAL_DOCS = {
  terms: {
    title: "İstifadə Şərtləri",
    subtitle: "Son yenilənmə tarixi: Avqust 2026",
    html: `
      <div class="legal-highlight-box">
        <strong>✦ 3-cü Tərəf Süni İntellekt API İstifadəsi</strong>
        Marketify AI xidməti strateji analizləri və marketinq nəticələrini generasiya etmək üçün qabaqcıl üçüncü tərəf süni intellekt provayderlərinin (o cümlədən OpenAI, Google AI və digər etibarlı LLM API infrastrukturlarının) rəsmi API sistemləri ilə fəaliyyət göstərir.
      </div>
      <h3>1. Ümumi Müddəalar və Xidmətin Təyinatı</h3>
      <p>Marketify AI platformasına (“Platforma”, “Xidmət”) xoş gəlmisiniz. Bu İstifadə Şərtləri (“Şərtlər”) sizin platformadan istifadənizi tənzimləyir. Xidmətdən istifadə etməklə siz bu şərtləri tam və qeyd-şərtsiz qəbul etmiş olursunuz.</p>
      
      <h3>2. 3-cü Tərəf API-ləri və Süni İntellekt Emalı</h3>
      <p>Platformada daxil etdiyiniz biznes brifləri, cavablar və sorğular ən müasir böyük dil modelləri (LLM) vasitəsilə təhlil edilir. Bu proses üçüncü tərəf API provayderləri üzərindən təhlükəsiz şifrələnmiş kanallarla həyata keçirilir.</p>
      <p>Marketify AI generasiya prosesində ən yüksək dəqiqlik və kontekstual uyğunluq təmin etmək üçün API sorğularını optimallaşdırır.</p>

      <h3>3. Əqli Mülkiyyət və Məzmun Hüquqları</h3>
      <p><strong>İstifadəçi Məlumatları:</strong> Daxil etdiyiniz bütün biznes ideyaları, məhsul detalları və fərdi qeydlər müstəsna olaraq sizə məxsusdur.</p>
      <p><strong>Generasiya Edilən Strategiyalar:</strong> Marketify AI vasitəsilə hazırladığınız bütün marketinq strategiyaları, fəaliyyət planları və sənədlər sizin sərəncamınızdadır və kommersiya və ya qeyri-kommersiya fəaliyyətinizdə sərbəst istifadə edilə bilər.</p>

      <h3>4. Məsuliyyətin Məhdudlaşdırılması və Tövsiyə Xarakteri</h3>
      <p>Süni intellekt tərəfindən generasiya olunan nəticələr, proqnozlar və fəaliyyət planları strateji bələdçi və məsləhət xarakteri daşıyır. Marketinq kampaniyalarının icrası, büdcə xərcləri və biznes qərarları üzrə yekun məsuliyyət istifadəçinin üzərindədir.</p>

      <h3>5. İstifadəçi Öhdəlikləri</h3>
      <p>İstifadəçilər qanunvericiliyə zidd, fırıldaqçılıq xarakterli və ya üçüncü şəxslərin hüquqlarını pozan sorğular göndərməməyi və sistemin/API-lərin fəaliyyətinə mane olmamağı öhdələrinə götürürlər.</p>
    `,
  },
  privacy: {
    title: "Məxfilik Siyasəti",
    subtitle: "Son yenilənmə tarixi: Avqust 2026",
    html: `
      <div class="legal-highlight-box">
        <strong>✦ Məlumatların Qorunması və 3-cü Tərəf API Şəffaflığı</strong>
        Marketify AI istifadəçi məlumatlarının təhlükəsizliyini təmin edir. Sorğuların cavablandırılması üçün 3-cü tərəf süni intellekt API provayderlərindən (OpenAI, Google) istifadə olunur və məlumatlar yalnız cari generasiya sessiyası məqsədilə emal edilir.
      </div>
      <h3>1. Toplanan Məlumatlar</h3>
      <p>• <strong>Profil və Giriş Məlumatları:</strong> Ad, soyad, istifadəçi adı, e-poçt ünvanı və təhlükəsiz şifrələnmiş giriş məlumatları.</p>
      <p>• <strong>Biznes Konteksti:</strong> Daxil etdiyiniz marketinq brifləri, aydınlaşdırma cavabları, arxivləşdirilmiş strategiyalar, söhbət tarixçəsi və planlaşdırılan tapşırıqlar.</p>
      <p>• <strong>Texniki Göstəricilər:</strong> Brauzer sessiya açarları və təhlükəsizlik jurnalları.</p>

      <h3>2. 3-cü Tərəf API İnteqrasiyası və Məlumatların Emalı</h3>
      <p>Marketify AI platforması sorğuları generasiya etmək məqsədilə etibarlı 3-cü tərəf süni intellekt API-lərinə müraciət edir.</p>
      <p>• Məlumatlar yalnız cari strategiyanın hazırlanması üçün API vasitəsilə təhlükəsiz TLS/HTTPS protokolu ilə göndərilir.</p>
      <p>• Sorğularınız 3-cü tərəf modellərinin açıq təlimi (training) üçün istifadə edilmir və yalnız sizin generasiya sessiyanızın tələblərini yerinə yetirmək üçün emal olunur.</p>
      <p>• Biz heç bir halda şəxsi identifikasiya məlumatlarınızı, şifrələrinizi və ya e-poçt ünvanınızı reklam və ya marketinq şirkətlərinə satmırıq və ötürmürük.</p>

      <h3>3. Məlumatların Saxlanması və Təhlükəsizlik</h3>
      <p>Bütün istifadəçi verilənləri müasir Cloudflare R2 bulud saxlancı, Redis keşləmə və gücləndirilmiş server mühitində etibarlı şəkildə qorunur.</p>

      <h3>4. Məlumatların İdarə Edilməsi və Silinməsi</h3>
      <p>İstifadəçilər istənilən an saxlanılmış strategiyalarını, keçmiş söhbətlərini və planlaşdırılan tapşırıqlarını arxivdən tamamilə silmək hüququna malikdirlər.</p>

      <h3>5. Əlaqə</h3>
      <p>Məxfilik siyasəti və ya məlumatların emalı ilə bağlı suallarınız üçün platforma üzərindən bizimlə əlaqə saxlaya bilərsiniz.</p>
    `,
  },
};

function openLegalModal(type) {
  const overlay = document.querySelector("#legalModalOverlay");
  if (!overlay) return;
  const doc = LEGAL_DOCS[type] || LEGAL_DOCS.terms;

  overlay.replaceChildren();
  const card = element("div", "legal-modal-card");

  const header = element("header", "legal-modal-header");
  const titleGroup = element("div", "legal-modal-title-group");
  titleGroup.append(element("h2", "", doc.title), element("p", "", doc.subtitle));

  const closeBtn = button("✕", "legal-modal-close", closeLegalModal);
  closeBtn.setAttribute("aria-label", "Bağla");

  header.append(titleGroup, closeBtn);

  const body = element("div", "legal-modal-body");
  body.innerHTML = doc.html;

  const footer = element("div", "legal-modal-footer");
  footer.appendChild(button("Bağla", "primary-button", closeLegalModal));

  card.append(header, body, footer);
  overlay.appendChild(card);
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLegalModal() {
  const overlay = document.querySelector("#legalModalOverlay");
  if (overlay) {
    overlay.hidden = true;
    overlay.replaceChildren();
  }
  document.body.style.overflow = "";
}

newStrategyButton?.addEventListener("click", () => {
  if (state.mode === "ask") startNewChat();
  else resetStrategy();
});
document.querySelector("#mobileNewButton")?.addEventListener("click", () => {
  if (state.mode === "ask") startNewChat();
  else resetStrategy();
});
mobileMenuButton.addEventListener("click", openSidebar);
railMenuButton.addEventListener("click", () => (sidebar.classList.contains("is-open") ? closeSidebar() : openSidebar()));
railHomeButton.addEventListener("click", () => {
  if (state.mode === "ask") startNewChat();
  else resetStrategy();
});
railStrategiesButton.addEventListener("click", () => {
  state.mode = "build";
  state.view = "list";
  render();
  closeSidebar();
});
railPlannerButton?.addEventListener("click", () => {
  state.mode = "build";
  state.view = "planner";
  render();
  closeSidebar();
});
sidebarClose.addEventListener("click", closeSidebar);
mobileOverlay.addEventListener("click", closeSidebar);
homeNav.addEventListener("click", () => {
  if (state.mode === "ask") startNewChat();
  else resetStrategy();
});
strategiesNav.addEventListener("click", () => {
  state.mode = "build";
  state.view = "list";
  render();
  closeSidebar();
});
plannerNav?.addEventListener("click", () => {
  state.mode = "build";
  state.view = "planner";
  render();
  closeSidebar();
});
settingsNav.addEventListener("click", () => {
  state.mode = "build";
  state.view = "settings";
  render();
  closeSidebar();
});
accountButton.addEventListener("click", () => {
  state.mode = "build";
  state.view = "settings";
  render();
  closeSidebar();
});
document.querySelector("#sidebarTermsBtn")?.addEventListener("click", () => {
  closeSidebar();
  openLegalModal("terms");
});
document.querySelector("#sidebarPrivacyBtn")?.addEventListener("click", () => {
  closeSidebar();
  openLegalModal("privacy");
});
document.querySelector("#legalModalOverlay")?.addEventListener("click", (event) => {
  if (event.target === document.querySelector("#legalModalOverlay")) closeLegalModal();
});
buildModeButton?.addEventListener("click", () => setMode("build"));
askModeButton?.addEventListener("click", () => setMode("ask"));
sidebarBuildModeButton?.addEventListener("click", () => setMode("build"));
sidebarAskModeButton?.addEventListener("click", () => setMode("ask"));
railModeToggleButton?.addEventListener("click", () => setMode(state.mode === "build" ? "ask" : "build"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
    closeLegalModal();
  }
});

initializeAuthentication(async (user) => {
  updateWorkspaceIdentity(user);
  render();
  showRegistrationNotice();
  await Promise.allSettled([loadSavedStrategies(), loadSavedChats(), loadPlannerTasks()]);
  if (window.location.hash === "#terms" || window.location.pathname === "/terms") {
    openLegalModal("terms");
  } else if (window.location.hash === "#privacy" || window.location.pathname === "/privacy") {
    openLegalModal("privacy");
  }
});
