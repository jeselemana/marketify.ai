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
const limitsNav = document.querySelector("#limitsNav");
const settingsNav = document.querySelector("#settingsNav");
const railLimitsButton = document.querySelector("#railLimitsButton");
const accountButton = document.querySelector("#accountButton");
const workspaceAvatar = document.querySelector("#workspaceAvatar");
const workspaceName = document.querySelector("#workspaceName");
const workspaceMeta = document.querySelector("#workspaceMeta");
const buildModeButton = document.querySelector("#buildModeButton");
const askModeButton = document.querySelector("#askModeButton");
const sidebarBuildModeButton = document.querySelector("#sidebarBuildModeButton");
const sidebarAskModeButton = document.querySelector("#sidebarAskModeButton");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

const LOADING_ASK_PLACEHOLDERS = [
  "Brendinq prosesi nə qədər vaxt aparır?",
  "Hədəf auditoriyanı necə dəqiq seqmentləşdirim?",
  "Marketinq büdcəsini kanallar üzrə necə bölüşdürməliyəm?",
  "Rəqib analizində ən vacib 3 metrikan nədir?",
  "B2B üçün ən effektiv satış kanalları hansılardır?",
  "CAC və LTV nisbətini necə optimallaşdıraq?",
  "Instagram reklamlarında ROAS-ı necə artıraq?",
  "Startap üçün ilkin böyümə (growth) taktikaları nələrdir?",
  "Strategiya hazır olduqdan sonra ilk addım nə olmalıdır?",
  "Məhsulun unikal satış təklifini (USP) necə formalaşdıraq?",
  "E-ticarətdə səbət tərketmə faizini necə azalda bilərik?",
  "Kontent marketinqi ilə orqanik trafiki necə artıraq?",
];

let loadingAskPlaceholderTimer = null;

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
  askModel: localStorage.getItem("marketify_ask_model") || "flash",
  currentUser: null,
  settingsTab: "account",
  strategyFormat: "blog",
  faqFilter: "",
  faqExpandedAll: false,
  limitsPeriod: "today",
  usageStats: null,
  limitsStatsExpanded: false,
  limitsFeaturesExpanded: false,
};

let progressTimer;
const freshAskResponses = new WeakSet();

// Background Jobs — analysis processes that continue when user leaves loading page
let backgroundJobs = loadBackgroundJobs();

function loadBackgroundJobs() {
  try {
    return JSON.parse(localStorage.getItem("marketify_bg_jobs") || "[]");
  } catch { return []; }
}

function persistBackgroundJobs() {
  try {
    localStorage.setItem("marketify_bg_jobs", JSON.stringify(backgroundJobs));
  } catch {}
}

function removeBackgroundJob(id) {
  backgroundJobs = backgroundJobs.filter((j) => j.id !== id);
  persistBackgroundJobs();
}

function clearCompletedBackgroundJobs() {
  backgroundJobs = backgroundJobs.filter((j) => j.status === "generating");
  persistBackgroundJobs();
}

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

let currentAbortController = null;

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      signal: options.signal,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
  } catch (error) {
    if (error.name === "AbortError" || options.signal?.aborted) {
      const abortErr = new Error("İcra dayandırıldı.");
      abortErr.name = "AbortError";
      throw abortErr;
    }
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
  const nonHomeViews = ["list", "settings", "planner", "limits"];
  homeNav.classList.toggle("is-active", isBuild ? !nonHomeViews.includes(state.view) : !["settings", "limits"].includes(state.view));
  strategiesNav.classList.toggle("is-active", isBuild && state.view === "list");
  plannerNav?.classList.toggle("is-active", isBuild && state.view === "planner");
  limitsNav?.classList.toggle("is-active", state.view === "limits");
  settingsNav.classList.toggle("is-active", state.view === "settings");
  railHomeButton.classList.toggle("is-active", isBuild ? !nonHomeViews.includes(state.view) : !["settings", "limits"].includes(state.view));
  railStrategiesButton.classList.toggle("is-active", isBuild && state.view === "list");
  railPlannerButton?.classList.toggle("is-active", isBuild && state.view === "planner");
  railLimitsButton?.classList.toggle("is-active", state.view === "limits");

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

function isHomePage() {
  if (state.view !== "home") return false;
  if (state.mode === "build") {
    return state.status === "draft" && !state.strategy;
  }
  return true;
}

function syncMode() {
  const isBuild = state.mode === "build";
  const isHome = isHomePage();

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
  document.body.dataset.isHome = String(isHome);
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
  clearInterval(loadingAskPlaceholderTimer);
  syncMode();
  syncNav();
  document.querySelectorAll(".loading-top-actions, #loadingTopActions, .loading-history-button, #analysisHistoryBtn, .loading-ask-floating-wrap, #loadingAskFloatingWrap, .loading-ask-modal-overlay").forEach((btn) => btn.remove());
  workspace.replaceChildren();
  workspace.className = "workspace";

  if (state.view === "settings") return renderSettings();
  if (state.view === "planner") return renderPlannerView();
  if (state.view === "limits") return renderLimitsView();
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

  const isFlash = state.askModel === "flash";
  const selectedStrategy = state.savedStrategies.find((strategy) => strategy.id === state.askStrategyId) || null;
  const shell = element("section", `ask-shell${isChatActive ? " has-messages" : " is-empty"}`);
  shell.setAttribute("aria-label", "Ask");
  const thread = element("div", "ask-thread");

  if (!state.askMessages.length) {
    const intro = element("div", "ask-intro");
    const activeModelName = isFlash ? "⚡ Flash (Gemini 3.7)" : "✦ Default (GPT-5.6)";
    const introBadge = element("div", "ask-intro-model-badge");
    introBadge.innerHTML = `<span class="ask-intro-badge-pill">${activeModelName}</span>`;
    intro.append(
      introBadge,
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

        if (message.model) {
          const modelBadge = element("span", "ask-message-model-pill", (message.model === "Flash" || message.model === "flash") ? "⚡ Flash" : "✦ Default");
          modelBadge.title = (message.model === "Flash" || message.model === "flash") ? "Model: Google Gemini 3.7 Flash" : "Model: OpenAI GPT-5.6 Luna";
          actions.appendChild(modelBadge);
        }

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
      const currentModelName = isFlash ? "Flash" : "Default";
      const thinkingLabel = element("span", "ask-thinking-label", `${currentModelName} düşünür…`);
      const dots = element("span", "ask-thinking-dots");
      dots.append(element("i"), element("i"), element("i"));
      thinking.append(mark, thinkingLabel, dots);
      row.appendChild(thinking);
      thread.appendChild(row);
      const thinkingPhrases = [`${currentModelName} düşünür…`, "Kontekst nəzərdən keçirilir", "Cavab strukturlaşdırılır", "Yekun cavab hazırlanır"];
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

  // Model selector dropdown
  const modelMenu = document.createElement("details");
  modelMenu.className = "ask-model-menu";
  const modelTrigger = element("summary", "ask-model-trigger");
  modelTrigger.setAttribute("aria-label", "Model seçimi");
  modelTrigger.title = isFlash ? "Model: Flash (Gemini 3.7)" : "Model: Default (GPT-5.6)";
  modelTrigger.innerHTML = `
    <span class="ask-model-trigger-label">${isFlash ? "⚡ Flash" : "✦ Default"}</span>
    <svg class="ask-model-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;

  const modelPopover = element("div", "ask-model-popover");
  modelPopover.appendChild(element("strong", "ask-model-popover-title", "Model seçimi"));
  const modelList = element("div", "ask-model-list");

  const modelOptions = [
    {
      id: "flash",
      name: "⚡ Flash",
      badge: "Gemini 3.7",
      desc: "Google Gemini 3.7 Flash — ultra sürətli və çevik",
    },
    {
      id: "default",
      name: "✦ Default",
      badge: "GPT-5.6",
      desc: "OpenAI GPT-5.6 Luna — analitik və dərin",
    },
  ];

  modelOptions.forEach((opt) => {
    const item = button("", `ask-model-item${state.askModel === opt.id ? " is-selected" : ""}`);
    item.type = "button";
    item.innerHTML = `
      <div class="ask-model-item-header">
        <span class="ask-model-item-name">${opt.name}</span>
        <span class="ask-model-item-badge">${opt.badge}</span>
      </div>
      <small class="ask-model-item-desc">${opt.desc}</small>
    `;
    item.addEventListener("click", () => {
      state.askModel = opt.id;
      try {
        localStorage.setItem("marketify_ask_model", opt.id);
      } catch {}
      modelMenu.open = false;
      render();
    });
    modelList.appendChild(item);
  });

  modelPopover.appendChild(modelList);
  modelMenu.append(modelTrigger, modelPopover);

  modelMenu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") modelMenu.open = false;
  });
  const closeModelMenu = (event) => {
    if (!modelMenu.contains(event.target)) modelMenu.open = false;
  };
  modelMenu.addEventListener("toggle", () => {
    if (modelMenu.open) setTimeout(() => document.addEventListener("click", closeModelMenu), 0);
    else document.removeEventListener("click", closeModelMenu);
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
  const metaLeft = element("div", "ask-meta-left");
  const contextMeta = element("span", "ask-context-meta", selectedStrategy ? `Kontekst: ${selectedStrategy.title}` : "Marketify");
  metaLeft.append(contextMeta, modelMenu);
  if (state.currentUser?.settings?.personalIntelligence === true) {
    const pBadge = button("⚡ Fərdiləşdirilmiş", "ask-personalization-badge", () => {
      state.view = "settings";
      state.settingsTab = "experience";
      render();
    });
    pBadge.type = "button";
    pBadge.title = "Fərdiləşdirilmiş təcrübə aktivdir. Tənzimləmək üçün klikləyin.";
    metaLeft.appendChild(pBadge);
  }
  helper.append(metaLeft, element("span", "", "Enter ilə göndər · Shift + Enter yeni sətir"));
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
  trackEvent("ask_message_sent", { messageCount: state.askMessages.length, model: state.askModel });
  render();
  try {
    const data = await api("/api/ask", {
      method: "POST",
      body: JSON.stringify({
        messages: state.askMessages,
        model: state.askModel,
        strategyId: state.askStrategyId || undefined,
        chatId: state.askChatId || undefined,
      }),
    });
    const response = { role: "assistant", content: data.reply, model: data.model || (state.askModel === "flash" ? "Flash" : "Default") };
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
  const activityIcon = element("div", "loading-activity-icon");
  activityIcon.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  `;
  const activityText = element("div", "loading-activity-text");
  const activityTitleRow = element("div", "loading-activity-title-row");
  const activityTitle = element("strong", "loading-activity-title", phases[0][0]);
  const processingDots = element("span", "loading-processing-dots");
  processingDots.innerHTML = `<span></span><span></span><span></span>`;
  activityTitleRow.append(activityTitle, processingDots);
  const copy = element("p", "loading-copy", phases[0][1]);
  activityText.append(activityTitleRow, copy);
  activityBody.append(activityIcon, activityText);
  activity.append(activityTop, activityBody);

  const timelineWrap = element("div", "loading-timeline-wrap");
  const progress = element("ol", "generation-steps");
  phases.forEach(([phase], index) => {
    const step = element("li", index === 0 ? "is-current" : "is-upcoming");
    const rail = element("div", "generation-step-rail");
    const meta = element("div", "generation-step-meta");
    const mark = element("span", "generation-step-mark", index === 0 ? "01" : String(index + 1).padStart(2, "0"));
    const label = element("span", "generation-step-label", phase);
    meta.append(mark, label);
    step.append(rail, meta);
    progress.appendChild(step);
  });
  timelineWrap.appendChild(progress);

  const reassurance = element("p", "loading-reassurance");
  const sparkIcon = element("span", "loading-reassurance-icon", "✦");
  const reassuranceText = element(
    "span",
    "",
    isAssessment
      ? "Vacib detal çatışmasa, yalnız zəruri sualları verəcəyik."
      : "Məzmun hazır olduqda birbaşa strategiya iş sahəsinə keçəcəksən.",
  );
  reassurance.append(sparkIcon, reassuranceText);

  // Desktop Top Right Actions
  const topActions = element("div", "loading-top-actions loading-desktop-actions");
  topActions.id = "loadingTopActions";

  const cancelBtn = element("button", "loading-cancel-button");
  cancelBtn.type = "button";
  cancelBtn.id = "cancelAnalysisBtn";
  cancelBtn.setAttribute("aria-label", "Brif analizini dayandır");
  cancelBtn.title = "Analizi dayandır";
  cancelBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <rect x="9" y="9" width="6" height="6" fill="currentColor" rx="1"/>
    </svg>
    <span>Dayandır</span>
  `;
  cancelBtn.addEventListener("click", () => {
    const confirmed = window.confirm("Brif analizini dayandırmaq istədiyinizdən əminsiniz?");
    if (confirmed) {
      cancelCurrentAnalysis();
    }
  });

  const historyBtn = element("button", "loading-history-button");
  historyBtn.type = "button";
  historyBtn.id = "analysisHistoryBtn";
  historyBtn.setAttribute("aria-label", "Tarixçə");
  historyBtn.title = "Söhbət və brif tarixçəsi";
  historyBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15 15"/>
    </svg>
    <span>Tarixçə</span>
    ${state.answers && state.answers.length > 0 ? `<span class="loading-history-badge">${state.answers.length}</span>` : ""}
  `;
  historyBtn.addEventListener("click", () => showAnalysisHistoryModal(isAssessment));

  // Background continuation button — only during generation (after clarification is done)
  if (!isAssessment) {
    const bgBtn = element("button", "loading-back-button");
    bgBtn.type = "button";
    bgBtn.setAttribute("aria-label", "İşi arxa planda davam etdir");
    bgBtn.title = "İşi arxa planda davam etdir";
    bgBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
      <span>İşi arxa planda davam etdir</span>
    `;
    bgBtn.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Əsas səhifəyə qayıdırsınız bu analizi arxa planda davam etdirmək istədiyinizdən əminsiniz? Daha sonra onunla \"Arxiv\" səhifəsindən tanış ola biləcəksiniz."
      );
      if (confirmed) {
        minimizeToBackground();
      }
    });
    topActions.prepend(bgBtn);
  }

  topActions.append(cancelBtn, historyBtn);

  // Mobile Under-Card Actions
  // Mobile Under-Card Actions
  const cardActions = element("div", "loading-card-actions");

  // Mobile background continuation button (prominent full-width button) — only during generation
  if (!isAssessment) {
    const mobileBgBtn = element("button", "loading-back-btn-mobile");
    mobileBgBtn.type = "button";
    mobileBgBtn.setAttribute("aria-label", "İşi arxa planda davam etdir");
    mobileBgBtn.title = "İşi arxa planda davam etdir";
    mobileBgBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
      <span>İşi arxa planda davam etdir</span>
    `;
    mobileBgBtn.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Əsas səhifəyə qayıdırsınız bu analizi arxa planda davam etdirmək istədiyinizdən əminsiniz? Daha sonra onunla \"Arxiv\" səhifəsindən tanış ola biləcəksiniz."
      );
      if (confirmed) {
        minimizeToBackground();
      }
    });
    cardActions.appendChild(mobileBgBtn);
  }

  const secondaryRow = element("div", "loading-card-actions-secondary");

  const mobileCancelBtn = element("button", "loading-cancel-btn-mobile");
  mobileCancelBtn.type = "button";
  mobileCancelBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <rect x="9" y="9" width="6" height="6" fill="currentColor" rx="1"/>
    </svg>
    <span>Dayandır</span>
  `;
  mobileCancelBtn.addEventListener("click", () => {
    const confirmed = window.confirm("Brif analizini dayandırmaq istədiyinizdən əminsiniz?");
    if (confirmed) {
      cancelCurrentAnalysis();
    }
  });

  const mobileHistoryBtn = element("button", "loading-history-btn-mobile");
  mobileHistoryBtn.type = "button";
  mobileHistoryBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15 15"/>
    </svg>
    <span>Tarixçə</span>
    ${state.answers && state.answers.length > 0 ? `<span class="loading-history-badge">${state.answers.length}</span>` : ""}
  `;
  mobileHistoryBtn.addEventListener("click", () => showAnalysisHistoryModal(isAssessment));

  secondaryRow.append(mobileCancelBtn, mobileHistoryBtn);
  cardActions.appendChild(secondaryRow);

  // Floating Ask Marketify Chat Button (Bottom-Right, Brief Analysis Only)
  const floatingWrap = element("div", "loading-ask-floating-wrap");
  floatingWrap.id = "loadingAskFloatingWrap";

  const floatingBtn = element("button", "loading-ask-floating-btn");
  floatingBtn.type = "button";
  floatingBtn.id = "loadingAskFloatingBtn";
  floatingBtn.setAttribute("aria-label", "Marketify-dan soruş");
  floatingBtn.title = "Marketify-dan soruş";
  floatingBtn.innerHTML = `
    <span class="loading-ask-floating-icon">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="loading-ask-floating-spark">✦</span>
    </span>
    <span class="loading-ask-floating-label">Marketify-dan soruş</span>
  `;
  floatingBtn.addEventListener("click", () => showLoadingAskModal(""));
  floatingWrap.appendChild(floatingBtn);

  document.querySelectorAll(".loading-top-actions, #loadingTopActions, .loading-history-button, #analysisHistoryBtn, .loading-ask-floating-wrap, #loadingAskFloatingWrap").forEach((el) => el.remove());
  document.body.appendChild(topActions);
  document.body.appendChild(floatingWrap);

  view.append(statusLine, title, intro, activity, timelineWrap, reassurance, cardActions);
  workspace.appendChild(view);

  progressTimer = setInterval(() => {
    currentPhase = Math.min(currentPhase + 1, phases.length - 1);
    activityTitle.textContent = phases[currentPhase][0];
    copy.textContent = phases[currentPhase][1];
    activityCount.textContent = `${String(currentPhase + 1).padStart(2, "0")} / ${String(phases.length).padStart(2, "0")}`;
    [...progress.children].forEach((step, index) => {
      step.className = index < currentPhase ? "is-complete" : index === currentPhase ? "is-current" : "is-upcoming";
      const mark = step.querySelector(".generation-step-mark");
      if (mark) {
        mark.textContent = index < currentPhase ? "✓" : String(index + 1).padStart(2, "0");
      }
    });
    if (currentPhase === phases.length - 1) clearInterval(progressTimer);
  }, 1500);
}

function cancelCurrentAnalysis() {
  clearInterval(progressTimer);
  clearInterval(loadingAskPlaceholderTimer);
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  document.querySelectorAll(".loading-top-actions, #loadingTopActions, .loading-history-button, #analysisHistoryBtn, .loading-ask-modal-overlay").forEach((el) => el.remove());
  state.status = "draft";
  showToast("Brif analizi dayandırıldı.", "default");
  render();
}

function minimizeToBackground() {
  if (state.status !== "generating") return;

  const job = {
    id: crypto.randomUUID(),
    brief: state.brief,
    answers: [...state.answers],
    assumptions: [...state.assumptions],
    idempotencyKey: state.clientSaveId,
    status: "generating",
    strategy: null,
    versions: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    savedId: null,
  };

  // Cancel any previous background job
  backgroundJobs.forEach((j) => {
    if (j.status === "generating") j.status = "error";
  });

  backgroundJobs.unshift(job);
  persistBackgroundJobs();

  // Do NOT abort currentAbortController — let the fetch continue
  // Detach the controller so resetStrategy doesn't abort it
  const detachedController = currentAbortController;
  currentAbortController = null;

  // Reset state to home without aborting
  clearInterval(progressTimer);
  clearInterval(loadingAskPlaceholderTimer);
  document.querySelectorAll(".loading-top-actions, #loadingTopActions, .loading-history-button, #analysisHistoryBtn, .loading-ask-floating-wrap, #loadingAskFloatingWrap, .loading-ask-modal-overlay").forEach((el) => el.remove());
  Object.assign(state, {
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
  showToast("Analiz arxa planda davam edir ✦", "default");

  // The fetch promise from startGeneration will resolve/reject and write to the bgJob
  // This is handled by the modified startGeneration() which checks backgroundJobs
}

async function autoSaveBackgroundJob(job) {
  try {
    const data = await api("/api/strategy/save", {
      method: "POST",
      body: JSON.stringify({
        clientSaveId: job.idempotencyKey,
        brief: job.brief,
        answers: job.answers,
        strategy: job.strategy,
        versions: job.versions,
      }),
    });
    job.savedId = data.strategy.id;
    removeBackgroundJob(job.id);
    await loadSavedStrategies();
    showToast("Strategiya hazırlandı və arxivə saxlanıldı ✓");
  } catch (error) {
    console.error("Auto-save background job failed:", error);
    persistBackgroundJobs();
  }
}

function resumeBackgroundJobs() {
  if (!backgroundJobs.length) return;

  backgroundJobs.forEach(async (job) => {
    // Check if the strategy was already saved on server by idempotencyKey or brief
    const alreadySaved = state.savedStrategies.find(
      (s) => (s.clientSaveId && s.clientSaveId === job.idempotencyKey) || (s.brief && s.brief === job.brief)
    );
    if (alreadySaved) {
      removeBackgroundJob(job.id);
      if (state.view === "list") renderStrategyList();
      return;
    }

    if (job.status !== "generating") return;

    try {
      const data = await api("/api/strategy/generate", {
        method: "POST",
        body: JSON.stringify({
          brief: job.brief,
          answers: job.answers,
          assumptions: job.assumptions,
          idempotencyKey: job.idempotencyKey,
        }),
      });

      // Check if user restored this job to foreground while in flight
      if (state.clientSaveId === job.idempotencyKey && state.status === "generating") {
        state.strategy = data.strategy;
        state.updatedAt = new Date().toISOString();
        state.versions = [{ versionNumber: 1, data: data.strategy, changeRequest: "İlkin strategiya", createdAt: state.updatedAt }];
        setStatus("ready");
        render();
        showToast("Strategiya hazırdır ✓");
        return;
      }

      job.status = "ready";
      job.strategy = data.strategy;
      job.completedAt = new Date().toISOString();
      job.versions = [{ versionNumber: 1, data: data.strategy, changeRequest: "İlkin strategiya", createdAt: job.completedAt }];
      persistBackgroundJobs();
      autoSaveBackgroundJob(job);
    } catch (err) {
      if (err.name === "AbortError") return;

      // If temporary network disconnection, keep in generating status and retry on reconnect
      if (!navigator.onLine) {
        return;
      }

      // Check if server already finished and saved it
      try {
        await loadSavedStrategies();
        const savedNow = state.savedStrategies.find(
          (s) => (s.clientSaveId && s.clientSaveId === job.idempotencyKey) || (s.brief && s.brief === job.brief)
        );
        if (savedNow) {
          removeBackgroundJob(job.id);
          if (state.view === "list") renderStrategyList();
          return;
        }
      } catch {}

      if (state.clientSaveId === job.idempotencyKey && state.status === "generating") {
        setError(err, startGeneration, state.questions?.length ? "needs_clarification" : "draft");
        return;
      }

      job.status = "error";
      job.error = err.message || "Xəta baş verdi";
      persistBackgroundJobs();
      if (state.view === "list") render();
    }
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    resumeBackgroundJobs();
  }
});
window.addEventListener("online", () => {
  resumeBackgroundJobs();
});

function openBackgroundJob(jobId) {
  const job = backgroundJobs.find((j) => j.id === jobId);
  if (!job) return;

  if (job.status === "ready" && job.strategy) {
    Object.assign(state, {
      view: "home",
      status: job.savedId ? "saved" : "ready",
      brief: job.brief,
      answers: job.answers || [],
      assumptions: job.strategy.assumptions || [],
      strategy: job.strategy,
      versions: job.versions || [],
      savedId: job.savedId || null,
      updatedAt: job.completedAt,
      error: null,
      retry: null,
    });
    removeBackgroundJob(jobId);
    render();
    closeSidebar();
  } else if (job.status === "generating") {
    // Restore to loading view
    Object.assign(state, {
      view: "home",
      status: "generating",
      brief: job.brief,
      answers: job.answers || [],
      assumptions: job.assumptions || [],
      clientSaveId: job.idempotencyKey,
    });
    removeBackgroundJob(jobId);
    render();
    closeSidebar();
  } else if (job.status === "error") {
    showToast(job.error || "Xəta baş verdi", "error");
    removeBackgroundJob(jobId);
    if (state.view === "list") render();
  }
}

function showAnalysisHistoryModal(isAssessment = true) {
  const existing = document.querySelector(".analysis-history-overlay");
  if (existing) existing.remove();

  const overlay = element("div", "analysis-history-overlay");
  const drawer = element("div", "analysis-history-drawer");
  const dragHandle = element("div", "analysis-history-drag-handle");
  dragHandle.setAttribute("aria-hidden", "true");

  const header = element("div", "analysis-history-header");
  const titleGroup = element("div", "analysis-history-title-group");
  const title = element("h3", "", "Söhbət və Brif Tarixçəsi");
  const subtitle = element("p", "", "Daxil edilmiş məlumatlar və dəqiqləşdirmə dialoqu");
  titleGroup.append(title, subtitle);

  const closeModal = () => {
    document.body.style.overflow = "";
    overlay.remove();
    document.removeEventListener("keydown", handleKeydown);
  };

  const closeBtn = element("button", "analysis-history-close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Bağla");
  closeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;
  closeBtn.addEventListener("click", closeModal);

  header.append(titleGroup, closeBtn);

  const body = element("div", "analysis-history-body");

  // 1. Initial Brief
  if (state.brief) {
    const briefItem = element("div", "history-item history-item-brief");
    briefItem.innerHTML = `
      <div class="history-item-header">
        <span class="history-item-icon user-icon">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
        <strong class="history-item-sender">İlkin Brif</strong>
        <span class="history-item-tag">İstifadəçi</span>
      </div>
      <div class="history-item-content">
        <p>${escapeHtml(state.brief)}</p>
      </div>
    `;
    body.appendChild(briefItem);
  }

  // 2. Clarification Questions & Answers
  if (state.answers && state.answers.length > 0) {
    state.answers.forEach((item, idx) => {
      const qaGroup = element("div", "history-qa-group");

      const qItem = element("div", "history-item history-item-model");
      qItem.innerHTML = `
        <div class="history-item-header">
          <span class="history-item-icon ai-icon">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </span>
          <strong class="history-item-sender">Dəqiqləşdirmə Sualı #${idx + 1}</strong>
          <span class="history-item-tag ai-tag">Marketify AI</span>
        </div>
        <div class="history-item-content">
          <p>${escapeHtml(item.question)}</p>
        </div>
      `;

      const aItem = element("div", "history-item history-item-user");
      aItem.innerHTML = `
        <div class="history-item-header">
          <span class="history-item-icon user-icon">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
          <strong class="history-item-sender">Cavabınız</strong>
          <span class="history-item-tag">İstifadəçi</span>
        </div>
        <div class="history-item-content">
          <p>${escapeHtml(item.answer)}</p>
        </div>
      `;

      qaGroup.append(qItem, aItem);
      body.appendChild(qaGroup);
    });
  } else if (!state.brief) {
    const emptyState = element("div", "history-empty-state");
    emptyState.innerHTML = `<p>Hələlik qeydə alınmış məlumat yoxdur.</p>`;
    body.appendChild(emptyState);
  }

  const footer = element("div", "analysis-history-footer");
  footer.innerHTML = `
    <div class="history-status-indicator">
      <span class="history-pulse-dot"></span>
      <span>${isAssessment ? "Brif analiz olunur…" : "Strategiya formalaşdırılır…"}</span>
    </div>
  `;

  drawer.append(dragHandle, header, body, footer);
  overlay.appendChild(drawer);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  const handleKeydown = (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  };
  document.addEventListener("keydown", handleKeydown);

  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);
}

function showLoadingAskModal(initialQuery) {
  const existing = document.querySelector(".loading-ask-modal-overlay");
  if (existing) existing.remove();

  const overlay = element("div", "loading-ask-modal-overlay");
  const modal = element("div", "loading-ask-modal");
  const dragHandle = element("div", "analysis-history-drag-handle");
  dragHandle.setAttribute("aria-hidden", "true");

  const header = element("div", "loading-ask-modal-header");
  const titleGroup = element("div", "loading-ask-modal-title-group");
  const titleRow = element("div", "loading-ask-modal-title-row");
  const title = element("h3", "", "Marketify-dan soruş");
  titleRow.appendChild(title);

  const statusSub = element("div", "loading-ask-modal-status");
  statusSub.innerHTML = `
    <span class="history-pulse-dot"></span>
    <span>Brif analizi arxa planda davam edir…</span>
  `;
  titleGroup.append(titleRow, statusSub);

  const closeModal = () => {
    document.body.style.overflow = "";
    overlay.remove();
    document.removeEventListener("keydown", handleKeydown);
  };

  const closeBtn = element("button", "analysis-history-close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Bağla");
  closeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;
  closeBtn.addEventListener("click", closeModal);
  header.append(titleGroup, closeBtn);

  const messagesBody = element("div", "loading-ask-modal-body");
  const formWrap = element("div", "loading-ask-modal-footer");
  const modalForm = element("form", "loading-ask-modal-form");
  const modalInput = element("input", "loading-ask-modal-input");
  modalInput.type = "text";
  modalInput.placeholder = "Əlavə sualını yaz…";
  modalInput.autocomplete = "off";
  modalInput.maxLength = 1000;

  const modalSend = element("button", "loading-ask-send-btn");
  modalSend.type = "submit";
  modalSend.setAttribute("aria-label", "Göndər");
  modalSend.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"></line>
      <polyline points="5 12 12 5 19 12"></polyline>
    </svg>
  `;
  modalForm.append(modalInput, modalSend);
  formWrap.appendChild(modalForm);

  modal.append(dragHandle, header, messagesBody, formWrap);
  overlay.appendChild(modal);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  const handleKeydown = (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  };
  document.addEventListener("keydown", handleKeydown);

  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);

  const thread = [];

  const appendUserMessage = (text) => {
    const item = element("div", "ask-thread-msg is-user");
    item.innerHTML = `
      <div class="ask-thread-msg-header">
        <span class="history-item-icon user-icon">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
        <strong>Siz</strong>
      </div>
      <div class="ask-thread-msg-content"><p>${escapeHtml(text)}</p></div>
    `;
    messagesBody.appendChild(item);
    messagesBody.scrollTop = messagesBody.scrollHeight;
  };

  const askAssistant = async (queryText) => {
    const welcome = messagesBody.querySelector(".loading-ask-welcome");
    if (welcome) welcome.remove();
    const suggestionsWrap = messagesBody.querySelector(".loading-ask-suggestions");
    if (suggestionsWrap) suggestionsWrap.remove();

    appendUserMessage(queryText);
    thread.push({ role: "user", content: queryText });

    const loadingItem = element("div", "ask-thread-msg is-assistant is-thinking");
    loadingItem.innerHTML = `
      <div class="ask-thread-msg-header">
        <span class="history-item-icon ai-icon">✦</span>
        <strong>Marketify AI</strong>
      </div>
      <div class="ask-thread-msg-content">
        <div class="loading-processing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    messagesBody.appendChild(loadingItem);
    messagesBody.scrollTop = messagesBody.scrollHeight;

    try {
      const data = await api("/api/ask", {
        method: "POST",
        body: JSON.stringify({
          messages: thread,
          model: state.askModel || "flash",
          chatId: state.askChatId || undefined,
        }),
      });

      loadingItem.classList.remove("is-thinking");
      const contentWrap = loadingItem.querySelector(".ask-thread-msg-content");
      contentWrap.innerHTML = "";
      contentWrap.appendChild(renderAskRichText(data.reply));
      thread.push({ role: "assistant", content: data.reply });

      if (data.chat?.id) {
        state.askChatId = data.chat.id;
        loadSavedChats();
      }
    } catch (err) {
      loadingItem.classList.remove("is-thinking");
      const contentWrap = loadingItem.querySelector(".ask-thread-msg-content");
      contentWrap.innerHTML = `<p class="ask-thread-error">${escapeHtml(err.message || "Cavab almaq mümkün olmadı.")}</p>`;
    } finally {
      messagesBody.scrollTop = messagesBody.scrollHeight;
      modalInput.focus();
    }
  };

  modalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = modalInput.value.trim();
    if (!val) return;
    modalInput.value = "";
    askAssistant(val);
  });

  if (initialQuery) {
    askAssistant(initialQuery);
  } else {
    const welcome = element("div", "loading-ask-welcome");
    welcome.innerHTML = `
      <div class="loading-ask-welcome-spark">✦</div>
      <div class="loading-ask-welcome-text">
        <strong>Marketify-dan soruş</strong>
        <p>Brif analizi arxa planda davam edərkən istənilən marketinq sualınızı verə bilərsiniz.</p>
      </div>
    `;
    const suggestionsWrap = element("div", "loading-ask-suggestions");
    const sampleQuestions = LOADING_ASK_PLACEHOLDERS.slice(0, 4);
    sampleQuestions.forEach((q) => {
      const pill = element("button", "loading-ask-suggestion-pill", q);
      pill.type = "button";
      pill.addEventListener("click", () => {
        askAssistant(q);
      });
      suggestionsWrap.appendChild(pill);
    });
    messagesBody.append(welcome, suggestionsWrap);
    setTimeout(() => modalInput.focus(), 120);
  }
}

async function startAssessment() {
  if (state.round === 0 && state.answers.length === 0) trackEvent("strategy_started");
  clearError();
  currentAbortController?.abort();
  currentAbortController = new AbortController();
  // Cancel previous in-progress background jobs to avoid duplicate generation load
  backgroundJobs.forEach((j) => {
    if (j.status === "generating") j.status = "error";
  });
  persistBackgroundJobs();
  setStatus("analyzing");
  render();
  try {
    const data = await api("/api/strategy/assess", {
      method: "POST",
      signal: currentAbortController.signal,
      body: JSON.stringify({
        brief: state.brief,
        answers: state.answers,
        round: state.round,
      }),
    });
    currentAbortController = null;
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
    if (error.name === "AbortError" || currentAbortController?.signal?.aborted) {
      return;
    }
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
  currentAbortController?.abort();
  currentAbortController = new AbortController();
  const generationKey = state.clientSaveId;
  setStatus("generating");
  render();
  try {
    const data = await api("/api/strategy/generate", {
      method: "POST",
      signal: currentAbortController.signal,
      body: JSON.stringify({
        brief: state.brief,
        answers: state.answers,
        assumptions: state.assumptions,
        idempotencyKey: state.clientSaveId,
      }),
    });
    currentAbortController = null;

    // Check if this generation was moved to background while awaiting
    const bgJob = backgroundJobs.find((j) => j.idempotencyKey === generationKey && j.status === "generating");
    if (bgJob) {
      bgJob.status = "ready";
      bgJob.strategy = data.strategy;
      bgJob.completedAt = new Date().toISOString();
      bgJob.versions = [{ versionNumber: 1, data: data.strategy, changeRequest: "İlkin strategiya", createdAt: bgJob.completedAt }];
      persistBackgroundJobs();
      autoSaveBackgroundJob(bgJob);
      return;
    }

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
    if (error.name === "AbortError" || currentAbortController?.signal?.aborted) {
      return;
    }
    // Check if this generation was moved to background
    const bgJob = backgroundJobs.find((j) => j.idempotencyKey === generationKey && j.status === "generating");
    if (bgJob) {
      bgJob.status = "error";
      bgJob.error = error.message || "Xəta baş verdi";
      persistBackgroundJobs();
      if (state.view === "list") render();
      return;
    }
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

  // 1. Refine button with minimalist magic wand / edit icon
  const refineBtn = button("", "dock-action-btn dock-refine-btn", (e) => {
    e.stopPropagation();
    panel.classList.toggle("is-expanded");
    const input = document.querySelector("#refinementInput");
    input?.focus();
  });
  refineBtn.innerHTML = `
    <svg class="dock-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
    </svg>
    <span>Dəyişiklik istə</span>
  `;

  // 2. Export wrap + button with minimalist download/export icon + menu
  const exportWrap = element("div", "export-wrap dock-export-wrap");
  const exportBtn = button("", "dock-action-btn dock-export-btn");
  exportBtn.setAttribute("aria-haspopup", "menu");
  exportBtn.setAttribute("aria-expanded", "false");
  exportBtn.innerHTML = `
    <svg class="dock-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>İxrac</span>
    <svg class="dock-chevron-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
  `;
  const menu = buildExportMenu(exportBtn);
  exportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle("is-open");
    exportBtn.setAttribute("aria-expanded", String(open));
  });
  exportWrap.append(exportBtn, menu);

  // Close export menu and dock expansion when clicking outside
  document.addEventListener("click", (e) => {
    if (!exportWrap.contains(e.target)) {
      menu.classList.remove("is-open");
      exportBtn.setAttribute("aria-expanded", "false");
    }
    if (!panel.contains(e.target)) {
      panel.classList.remove("is-expanded");
    }
  });

  // 3. Save button with minimalist bookmark/check icon
  const saveBtn = button("", `dock-action-btn dock-save-btn${state.savedId ? " is-saved" : ""}`, saveStrategy);
  saveBtn.disabled = Boolean(state.savedId) || state.status === "refining";
  const saveIconSvg = state.savedId
    ? `<svg class="dock-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg class="dock-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
  saveBtn.innerHTML = `
    ${saveIconSvg}
    <span>${state.savedId ? "Yadda saxlanıb" : "Yadda saxla"}</span>
  `;

  actionsStrip.append(refineBtn, exportWrap, saveBtn);

  // Middle: Quick suggestions with modern icons
  const quick = element("div", "quick-actions");
  const quickIcons = {
    shorten: "⚡",
    localize_azerbaijan: "📍",
    think_deeper: "✦",
    make_practical: "💼",
    budget_optimize: "💰",
  };
  QUICK_ACTIONS.forEach(([action, label]) => {
    const icon = quickIcons[action] || "✦";
    const actionButton = button("", "quick-action", () => requestRefinement(action, ""));
    actionButton.innerHTML = `<span class="quick-action-icon">${icon}</span><span>${label}</span>`;
    actionButton.disabled = state.status === "refining";
    quick.appendChild(actionButton);
  });

  // Bottom: Refinement input form
  const form = element("form", "refinement-form");
  const label = element("label", "sr-only", "Dəyişiklik istəyi");
  label.htmlFor = "refinementInput";

  const inputPrefix = element("div", "refine-input-prefix");
  inputPrefix.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`;

  const input = element("textarea", "refinement-input");
  input.id = "refinementInput";
  input.rows = 1;
  input.maxLength = 2000;
  input.placeholder = "Marketify-dan dəyişiklik istə";
  input.disabled = state.status === "refining";

  const submit = button("", "refine-submit");
  submit.type = "submit";
  submit.disabled = true;
  submit.setAttribute("aria-label", "Dəyişiklik istəyini göndər");
  submit.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;

  form.append(label, inputPrefix, input, submit);

  const resizeInput = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
    submit.disabled = input.value.trim().length < 3 || state.status === "refining";
  };

  input.addEventListener("input", resizeInput);
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

  if (!state.savedStrategies.length && !backgroundJobs.some((j) => j.status === "generating")) {
    const empty = element("div", "recent-empty");
    empty.append(element("strong", "", "Strategiyalar burada görünəcək."), element("span", "", "Yadda saxladığın işlər bu bölmədə qalır."));
    recentList.appendChild(empty);
    return;
  }

  // Show active background jobs at top of recent list
  backgroundJobs.filter((j) => j.status === "generating").forEach((job) => {
    const item = button("", "recent-item is-bg-job", () => openBackgroundJob(job.id));
    const icon = element("span", "recent-icon-wrap");
    icon.innerHTML = `<svg class="recent-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    const pulse = element("span", "recent-bg-pulse");
    icon.appendChild(pulse);
    const textWrap = element("div", "recent-text-wrap");
    textWrap.append(element("span", "recent-title", "Hazırlanır..."), element("span", "recent-date", formatDate(job.startedAt)));
    item.append(icon, textWrap);
    recentList.appendChild(item);
  });

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

function settingsField(label, name, value, type = "text", autocomplete = "off", placeholder = "") {
  const wrapper = element("label", "settings-field");
  const input = element("input", "settings-input");
  input.name = name;
  input.type = type;
  input.value = value || "";
  input.autocomplete = autocomplete;
  if (placeholder) input.placeholder = placeholder;
  input.setAttribute("aria-label", label);
  wrapper.append(element("span", "settings-field-label", label), input);
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
  const experienceTab = button("Təcrübə", `settings-tab${state.settingsTab === "experience" ? " is-active" : ""}`, () => {
    state.settingsTab = "experience";
    renderSettings();
  });
  const legalTab = button("Hüquqi & Məxfilik", `settings-tab${state.settingsTab === "legal" ? " is-active" : ""}`, () => {
    state.settingsTab = "legal";
    renderSettings();
  });
  tabs.append(accountTab, experienceTab, securityTab, legalTab);
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
  } else if (state.settingsTab === "experience") {
    const panel = element("section", "settings-panel settings-experience-panel");
    panel.append(
      element("h2", "", "Fərdiləşdirilmiş təcrübə"),
      element("p", "settings-panel-intro", "Brendinizi, sahənizi və cavab üslubunuzu təyin edərək Marketify AI-ın sizin biznesinizə tam uyğunlaşmasını təmin edin."),
    );

    const userSettings = state.currentUser.settings || {};
    let currentTone = userSettings.tone || "professional";
    let memoriesList = Array.isArray(userSettings.memories) ? [...userSettings.memories] : [];

    // Master Switch
    const masterCard = element("div", "experience-hero-toggle");
    const masterLeft = element("div", "experience-hero-left");
    masterLeft.append(
      element("strong", "", "Fərdiləşdirilmiş cavablar və strategiyalar"),
      element("p", "", "Aktiv olduqda Ask söhbətləri və Build rejimi aşağıdakı brend profili, üslub və yaddaş qeydləri əsasında cavab verir."),
    );
    const masterToggle = element("button", "settings-toggle");
    masterToggle.type = "button";
    masterToggle.setAttribute("role", "switch");
    masterToggle.setAttribute("aria-label", "Fərdiləşdirilmiş təcrübə");
    let isMasterEnabled = userSettings.personalIntelligence === true;
    const syncMasterToggle = () => {
      masterToggle.classList.toggle("is-active", isMasterEnabled);
      masterToggle.setAttribute("aria-checked", String(isMasterEnabled));
    };
    masterToggle.appendChild(element("span", "settings-toggle-thumb"));
    syncMasterToggle();
    masterToggle.addEventListener("click", () => {
      isMasterEnabled = !isMasterEnabled;
      syncMasterToggle();
    });
    masterCard.append(masterLeft, masterToggle);
    panel.appendChild(masterCard);

    const form = element("form", "settings-form experience-settings-form");

    function createExperienceAccordion({ title, desc, badgeNode = null, isOpen = false, contentNode }) {
      const details = document.createElement("details");
      details.className = "experience-accordion";
      if (isOpen) details.open = true;

      const summary = element("summary", "experience-accordion-summary");
      const summaryLeft = element("div", "experience-accordion-left");
      const titleRow = element("div", "experience-accordion-title-row");
      titleRow.appendChild(element("strong", "experience-accordion-title", title));
      if (badgeNode) {
        titleRow.appendChild(badgeNode);
      }
      summaryLeft.appendChild(titleRow);
      if (desc) {
        summaryLeft.appendChild(element("p", "experience-accordion-desc", desc));
      }

      const iconWrap = element("span", "experience-accordion-icon");
      iconWrap.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

      summary.append(summaryLeft, iconWrap);
      const body = element("div", "experience-accordion-content");
      body.appendChild(contentNode);
      details.append(summary, body);
      return details;
    }

    // 1. Business Profile (Primary - Open by default)
    const profileGrid = element("div", "experience-grid-fields");
    profileGrid.append(
      settingsField("Brend / Layihə adı", "brandName", userSettings.brandName || "", "text", "organization", "Məs: Marketify AI"),
      settingsField("Fəaliyyət sahəsi / Sənaye", "industry", userSettings.industry || "", "text", "off", "Məs: B2B SaaS, E-ticarət, Kosmetika"),
      settingsField("Əsas bazar / Coğrafiya", "primaryMarket", userSettings.primaryMarket || "", "text", "off", "Məs: Azərbaycan (Bakı və regionlar)"),
      settingsField("Hədəf kütlə", "targetAudience", userSettings.targetAudience || "", "text", "off", "Məs: 20-35 yaş gənclər, startaplar"),
    );
    const profileAccordion = createExperienceAccordion({
      title: "Biznes və brend profili",
      desc: "Hər dəfə şirkətiniz haqqında təkrar məlumat verməmək üçün əsas detalları daxil edin.",
      isOpen: true,
      contentNode: profileGrid,
    });
    form.appendChild(profileAccordion);

    // 2. Tone & Voice (Secondary - Collapsible)
    const toneGrid = element("div", "experience-tone-grid");
    const toneOptions = [
      {
        id: "professional",
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
        name: "Peşəkar və Analitik",
        desc: "Dəqiq biznes arqumentləri, strukturlaşdırılmış təhlil və rəsmi terminlər.",
      },
      {
        id: "creative",
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
        name: "Yaradıcı və Cəsarətli",
        desc: "Fərqli marketinq ideyaları, viral konseptlər və təsirli şüarlar.",
      },
      {
        id: "concise",
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        name: "Qısa və İcra Yönümlü",
        desc: "Girişsiz, birbaşa icra addımları, qısa bəndlər və dərhal tətbiq olunan həllər.",
      },
      {
        id: "friendly",
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        name: "Dostcasına və İzahlı",
        desc: "Səmimi dil, anlaşıqlı yanaşma və marketinq terminlərinin sadə izahı.",
      },
      {
        id: "data_driven",
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
        name: "Nəticə və Satış Yönümlü",
        desc: "Dönüşüm (conversion), ROAS, satış qıfı və ölçülə bilən KPI fokuslu.",
      },
    ];

    const currentToneObj = toneOptions.find((t) => t.id === currentTone) || toneOptions[0];
    const toneBadge = element("span", "experience-summary-badge", currentToneObj.name);

    toneOptions.forEach((opt) => {
      const card = element("button", `experience-tone-card${currentTone === opt.id ? " is-selected" : ""}`);
      card.type = "button";
      card.innerHTML = `
        <div class="tone-card-top">
          <span class="tone-card-icon-wrap">${opt.icon}</span>
          <strong class="tone-card-title">${opt.name}</strong>
          <span class="tone-card-check"></span>
        </div>
        <p class="tone-card-desc">${opt.desc}</p>
      `;
      card.addEventListener("click", () => {
        currentTone = opt.id;
        toneBadge.textContent = opt.name;
        toneGrid.querySelectorAll(".experience-tone-card").forEach((c) => c.classList.remove("is-selected"));
        card.classList.add("is-selected");
      });
      toneGrid.appendChild(card);
    });

    const toneAccordion = createExperienceAccordion({
      title: "AI cavab üslubu və tonu",
      desc: "Cavabların və tərtib olunan strategiyaların hansı tonda təqdim olunmasını seçin.",
      badgeNode: toneBadge,
      isOpen: false,
      contentNode: toneGrid,
    });
    form.appendChild(toneAccordion);

    // 3. Custom Instructions (Secondary - Collapsible)
    const customLabel = element("label", "settings-field");
    const customTextarea = element("textarea", "settings-input settings-textarea");
    customTextarea.name = "customInstructions";
    customTextarea.rows = 3;
    customTextarea.maxLength = 2000;
    customTextarea.placeholder = "Məsələn: Təkliflərdə həmişə büdcəyə qənaətcil rəqəmsal kanalları önə çək. Cavablarda addım-addım icra planı və ölçülə bilən KPI cədvəli təqdim et...";
    customTextarea.value = userSettings.customInstructions || "";
    customLabel.append(element("span", "settings-field-label", "Təlimat mətni"), customTextarea);

    const customAccordion = createExperienceAccordion({
      title: "Xüsusi təlimatlar (Custom Instructions)",
      desc: "Marketify-ın sizin üçün cavab hazırlayarkən riayət etməli olduğu xüsusi qaydalar.",
      isOpen: false,
      contentNode: customLabel,
    });
    form.appendChild(customAccordion);

    // 4. Memory Hub (Secondary - Collapsible)
    const memoryWrapper = element("div", "experience-memory-wrapper");
    const memoryListContainer = element("div", "experience-memory-list");
    const memoryBadge = element("span", "experience-summary-badge", `${memoriesList.length} qeyd`);

    const renderMemories = () => {
      memoryListContainer.replaceChildren();
      memoryBadge.textContent = `${memoriesList.length} qeyd`;
      if (!memoriesList.length) {
        const empty = element("p", "experience-memory-empty", "Hələ heç bir yaddaş qeydi saxlanılmayıb.");
        memoryListContainer.appendChild(empty);
        return;
      }
      memoriesList.forEach((mem) => {
        const item = element("div", "experience-memory-item");
        const categoryNames = {
          business: "Biznes",
          audience: "Auditoriya",
          preference: "Üstünlük",
          constraint: "Məhdudiyyət",
          general: "Qeyd",
        };
        const catLabel = categoryNames[mem.category] || "Qeyd";
        item.innerHTML = `
          <div class="memory-item-content">
            <span class="memory-category-tag tag-${escapeHtml(mem.category || "general")}">${catLabel}</span>
            <span class="memory-text">${escapeHtml(mem.text)}</span>
          </div>
        `;
        const delBtn = button("", "memory-delete-btn", () => {
          memoriesList = memoriesList.filter((m) => m.id !== mem.id);
          renderMemories();
        });
        delBtn.type = "button";
        delBtn.title = "Qeydi sil";
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        item.appendChild(delBtn);
        memoryListContainer.appendChild(item);
      });
    };
    renderMemories();

    const addMemoryRow = element("div", "experience-add-memory-row");
    const memoryInput = element("input", "settings-input");
    memoryInput.type = "text";
    memoryInput.placeholder = "Yeni fakt əlavə et... məs. Biz yalnız B2B şirkətlərlə işləyirik";
    memoryInput.maxLength = 500;

    const memoryCategorySelect = element("select", "settings-input settings-select");
    [
      { val: "business", label: "Biznes Faktı" },
      { val: "audience", label: "Hədəf Kütlə" },
      { val: "preference", label: "Üstünlük" },
      { val: "constraint", label: "Məhdudiyyət" },
      { val: "general", label: "Ümumi Qeyd" },
    ].forEach((c) => {
      const opt = element("option", "", c.label);
      opt.value = c.val;
      memoryCategorySelect.appendChild(opt);
    });

    const checkSensitiveData = (txt) => {
      if (!txt) return null;
      const t = txt.trim();
      const phonePats = [
        /(?:\+994|00994|994)?[\s.-]?(?:0?(?:10|50|51|55|60|70|77|99|12|18|20|21|22|23|24|25|26|36))[\s.-]?[0-9]{3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/i,
        /(?:\btelefon|\bnömrə|\bnömrəm|\bmobil|\bwhatsapp|\bəlaqə|\bphone|\bcall|\btel)[\s:]*[\s.-]?(?:\+?[0-9]{1,4}[\s.-]?)?[0-9]{5,12}/i,
        /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2,4}/,
        /\b0[1-9][0-9]{8}\b/,
      ];
      for (const r of phonePats) {
        if (r.test(t)) return "Yaddaşda telefon və ya mobil nömrələrin saxlanılmasına icazə verilmir.";
      }
      const addrPats = [
        /(?:yaşayış\s*ünvanı|ev\s*ünvanı|ev\s*ünvanım|yaşayış\s*yeri|evimin\s*ünvanı|qeydiyyat\s*ünvanı)/i,
        /(?:residential\s*address|home\s*address|living\s*address|apartment\s*address)/i,
        /(?:küç(?:əsi|\.)|prospekt(?:i|\.)|pr\.|döngə(?:si|\.)|dalan(?:ı|\.))\s*(?:[0-9]+|[A-ZƏÖĞÇŞÜa-zəöğçşü]+)\s*,?\s*(?:ev|bina|mənzil|blok|korpus|mərtəbə)\s*[0-9]+/i,
        /(?:ev|bina|korpus)\s*[0-9]+\s*,\s*mənzil\s*[0-9]+/i,
        /(?:mənzil\s*no|mənzil\s*№|mənzil\s*nömrəsi|apt\s*#|apt\s*no)\s*[0-9]+/i,
        /(?:yaşayıram|yaşayırıq)\s*:\s*.+/i,
      ];
      for (const r of addrPats) {
        if (r.test(t)) return "Yaddaşda dəqiq yaşayış və ya ev ünvanlarının saxlanılmasına icazə verilmir.";
      }
      const payPats = [
        /\b(?:\d{4}[ -]?){3}\d{4}\b/,
        /\b(?:cvv|cvc|cvv2|cvc2)(?:\s*(?:kodu?m?|code))?[\s:=]*[0-9]{3,4}\b/i,
        /\bAZ\d{2}[A-Z0-9]{24}\b/i,
        /(?:kart\s*nömrəsi|hesab\s*nömrəsi|kredit\s*kartı|bank\s*kartı)[\s:]*[0-9]{8,20}/i,
      ];
      for (const r of payPats) {
        if (r.test(t)) return "Yaddaşda bank kartı, CVV və ya hesab məlumatlarının saxlanılmasına icazə verilmir.";
      }
      const idPats = [
        /(?:fin(?:\s*kodu?m?)?|f[iİ]n|şv(?:\s*seriya(?:sı)?)?|şəxsiyyət\s*vəsiqəsi|pasport(?:\s*nömrəsi)?|pin(?:\s*code|\s*kodu?m?)?|ssn)[\s:=]*[a-zA-Z0-9]{6,10}/i,
        /\b(?:AZE|AA)\s*[0-9]{7,8}\b/i,
      ];
      for (const r of idPats) {
        if (r.test(t)) return "Yaddaşda FİN kod, şəxsiyyət vəsiqəsi və ya pasport məlumatlarının saxlanılmasına icazə verilmir.";
      }
      const secPats = [
        /(?:şifrə(?:m)?|parol(?:um)?|password|api[_-]?key|secret[_-]?key|token|auth[_-]?token)[\s:=]+[\S]{4,}/i,
      ];
      for (const r of secPats) {
        if (r.test(t)) return "Yaddaşda şifrə, API açarı və ya məxfi tokenlərin saxlanılmasına icazə verilmir.";
      }
      return null;
    };

    const addMemoryBtn = button("Əlavə et", "secondary-button experience-add-btn", () => {
      const text = memoryInput.value.trim();
      if (!text) return;
      const sensitiveWarning = checkSensitiveData(text);
      if (sensitiveWarning) {
        showToast(sensitiveWarning, "error");
        return;
      }
      if (memoriesList.length >= 50) {
        showToast("Maksimum 50 yaddaş qeydi saxlanıla bilər.", "error");
        return;
      }
      memoriesList.unshift({
        id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        text,
        category: memoryCategorySelect.value,
        createdAt: new Date().toISOString(),
      });
      memoryInput.value = "";
      renderMemories();
    });
    addMemoryBtn.type = "button";

    addMemoryRow.append(memoryInput, memoryCategorySelect, addMemoryBtn);

    const memoryFooter = element("div", "experience-memory-footer");
    const clearMemoriesBtn = button("Bütün yaddaşı təmizlə", "danger-text-button", () => {
      if (confirm("Bütün yaddaş qeydlərini silmək istədiyinizdən əminsiniz?")) {
        memoriesList = [];
        renderMemories();
      }
    });
    clearMemoriesBtn.type = "button";
    memoryFooter.appendChild(clearMemoriesBtn);

    memoryWrapper.append(memoryListContainer, addMemoryRow, memoryFooter);

    const memoryAccordion = createExperienceAccordion({
      title: "Aktiv yaddaş qeydləri (Memory Hub)",
      desc: "Modelin sizin biznesiniz haqqında unutmamasını istədiyiniz konkret faktlar.",
      badgeNode: memoryBadge,
      isOpen: false,
      contentNode: memoryWrapper,
    });
    form.appendChild(memoryAccordion);

    // 5. Scopes (Secondary - Collapsible)
    const scopesWrapper = element("div", "experience-scopes-wrapper");
    let isAutoContext = userSettings.autoContext !== false;
    let isStrategyPersonalization = userSettings.strategyPersonalization !== false;

    const createScopeRow = (title, desc, initialVal, onToggle) => {
      const row = element("div", "settings-toggle-row");
      const copy = element("div", "settings-toggle-copy");
      copy.append(element("strong", "", title), element("p", "", desc));
      const toggle = element("button", "settings-toggle");
      toggle.type = "button";
      toggle.setAttribute("role", "switch");
      let active = initialVal;
      const sync = () => {
        toggle.classList.toggle("is-active", active);
        toggle.setAttribute("aria-checked", String(active));
      };
      toggle.appendChild(element("span", "settings-toggle-thumb"));
      sync();
      toggle.addEventListener("click", () => {
        active = !active;
        sync();
        onToggle(active);
      });
      row.append(copy, toggle);
      return row;
    };

    scopesWrapper.append(
      createScopeRow("Ask söhbətlərində keçmiş kontekstdən istifadə", "Cari sualınızla bağlı olduqda keçmiş söhbətlər və strategiyalardan faydalı məlumatlar avtomatik cəlb edilir.", isAutoContext, (v) => { isAutoContext = v; }),
      createScopeRow("Build rejimində yeni strategiyalara tətbiq etmə", "Yeni strategiya yaradarkən və dəqiqləşdirərkən yuxarıdakı brend profili və ton nəzərə alınır.", isStrategyPersonalization, (v) => { isStrategyPersonalization = v; }),
    );

    const scopesAccordion = createExperienceAccordion({
      title: "Tətbiq rejimləri",
      desc: "Fərdiləşdirmənin hansı modullarda işləməsini tənzimləyin.",
      isOpen: false,
      contentNode: scopesWrapper,
    });
    form.appendChild(scopesAccordion);

    // Save bar
    const save = button("Dəyişiklikləri saxla", "primary-button experience-save-btn");
    save.type = "submit";
    form.appendChild(save);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      save.disabled = true;
      save.textContent = "Saxlanılır…";
      const formData = new FormData(form);
      const payload = {
        personalIntelligence: isMasterEnabled,
        brandName: String(formData.get("brandName") || "").trim(),
        industry: String(formData.get("industry") || "").trim(),
        primaryMarket: String(formData.get("primaryMarket") || "").trim(),
        targetAudience: String(formData.get("targetAudience") || "").trim(),
        tone: currentTone,
        customInstructions: String(formData.get("customInstructions") || "").trim(),
        memories: memoriesList,
        autoContext: isAutoContext,
        strategyPersonalization: isStrategyPersonalization,
      };
      try {
        const data = await authRequest("/api/auth/settings", {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        updateWorkspaceIdentity(data.user);
        settingsMessage(form, "Fərdiləşdirilmiş təcrübə parametrləri uğurla yeniləndi.", "success");
        showToast("Parametrlər yadda saxlanıldı.");
      } catch (error) {
        settingsMessage(form, error.message);
        showToast(error.message, "error");
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

    // Danger Zone: Account Deletion (14-day grace period)
    const isPendingDeletion = state.currentUser?.status === "pending_deletion" || Boolean(state.currentUser?.scheduledDeletionAt);
    const deleteAccountBox = element("div", `settings-signout settings-danger-zone${isPendingDeletion ? " is-pending-deletion" : ""}`);
    const deleteCopy = element("div");

    if (isPendingDeletion) {
      const schedDate = state.currentUser.scheduledDeletionAt
        ? new Date(state.currentUser.scheduledDeletionAt).toLocaleDateString("az-AZ", { day: "numeric", month: "long", year: "numeric" })
        : "14 gün sonra";
      deleteCopy.append(
        element("strong", "danger-zone-title text-warning", "⚠️ Hesabın silinməsi gözlənilir"),
        element("p", "", `Hesabınız 14 günlük gözləmə rejimindədir. Yekun silinmə tarixi: ${schedDate}. Bu tarixə qədər silinməni istədiyiniz vaxt ləğv edə bilərsiniz.`)
      );
      const cancelDeletionBtn = button("Silinməni ləğv et", "secondary-button experience-restore-btn", async () => {
        cancelDeletionBtn.disabled = true;
        cancelDeletionBtn.textContent = "Bərpa edilir…";
        try {
          const res = await authRequest("/api/auth/account/cancel-deletion", { method: "POST" });
          if (res?.user) state.currentUser = res.user;
          showToast("Silinmə sorğusu ləğv edildi və hesabınız bərpa olundu.", "success");
          render();
        } catch (err) {
          showToast(err.message || "Xəta baş verdi.", "error");
          cancelDeletionBtn.disabled = false;
          cancelDeletionBtn.textContent = "Silinməni ləğv et";
        }
      });
      deleteAccountBox.append(deleteCopy, cancelDeletionBtn);
    } else {
      deleteCopy.append(
        element("strong", "danger-zone-title text-danger", "Hesabı sil"),
        element("p", "", "Hesabınızı və bütün məlumatlarınızı sistemdən silin.")
      );
      const deleteBtn = button("Hesabı sil", "danger-button", openDeleteAccountModal);
      deleteAccountBox.append(deleteCopy, deleteBtn);
    }

    panel.append(form, signOut, deleteAccountBox);
    view.appendChild(panel);
  } else {
    const panel = element("section", "settings-panel");
    panel.append(
      element("h2", "", "Hüquqi Şərtlər və Məxfilik"),
      element("p", "settings-panel-intro", "Platformanın istifadə qaydaları və 3-cü tərəf süni intellekt API şərtləri ilə tanış ol.")
    );

    const apiNotice = element("div", "legal-highlight-box");
    apiNotice.innerHTML = "<strong>✦ 3-cü Tərəf Süni İntellekt API İnteqrasiyası</strong>Marketify AI xidməti biznes analizləri və strategiya generasiyası üçün qabaqcıl süni intellekt API provayderlərinin rəsmi infrastrukturundan istifadə edir.";
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
  copy.append(
    element("span", "section-kicker", "WORKSPACE"),
    element("h1", "", "Arxiv"),
    element("p", "", "Yadda saxladığın bütün strategiyalar və işlər.")
  );
  heading.append(copy, button("＋ Yeni strategiya", "primary-button", resetStrategy));
  view.appendChild(heading);

  const activeBgJobs = backgroundJobs.filter((j) => j.status === "generating" || j.status === "ready" || j.status === "error");

  if (!state.savedStrategies.length && !activeBgJobs.length) {
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
    view.appendChild(controls);

    const list = element("div", "strategy-library");

    const drawRows = () => {
      const query = search.value.trim().toLocaleLowerCase("az");
      list.replaceChildren();

      // Render active background jobs seamlessly at the top of the archive list
      const matchingBgJobs = activeBgJobs.filter((job) => !query || `${job.brief || ""} ${job.strategy?.summary || ""}`.toLocaleLowerCase("az").includes(query));
      matchingBgJobs.forEach((job) => {
        const isGenerating = job.status === "generating";
        const isError = job.status === "error";
        const row = element("article", `strategy-library-row ${isGenerating ? "library-row-progress" : isError ? "library-row-error" : ""}`);

        const main = element("div", "library-row-main");
        const briefTitle = job.brief ? (job.brief.length > 70 ? job.brief.slice(0, 70) + "…" : job.brief) : "Yeni Strategiya";
        const subtitle = isGenerating
          ? "Məlumatlar analiz olunur və strateji plan formalaşdırılır…"
          : isError
          ? (job.error || "Generasiya zamanı xəta baş verdi.")
          : (firstSentences(job.strategy?.summary || job.brief, 1));
        main.append(element("h2", "", isGenerating ? briefTitle : (job.strategy?.title || briefTitle)), element("p", "", subtitle));

        const meta = element("div", "library-row-meta");
        meta.append(
          element("span", "", `Başladı ${formatDate(job.startedAt)}`),
          element("span", "", isGenerating ? "Arxa planda icra" : isError ? "Uğursuz oldu" : "Versiya 1")
        );

        if (isGenerating) {
          const statusEl = element("span", "saved-status is-generating");
          const pulse = element("span", "bg-job-pulse");
          statusEl.append(pulse, document.createTextNode("Hazırlanır"));
          const openBtn = button("Bax →", "text-button", () => openBackgroundJob(job.id));
          row.append(main, meta, statusEl, openBtn);
        } else if (job.status === "ready") {
          const statusEl = element("span", "saved-status", "Hazırdır");
          const openBtn = button("Aç →", "text-button", () => openBackgroundJob(job.id));
          row.append(main, meta, statusEl, openBtn);
        } else if (isError) {
          const statusEl = element("span", "saved-status is-error", "Xəta");
          const actionsWrap = element("div", "bg-job-error-actions");
          const retryBtn = button("Yoxla", "bg-job-retry-btn", () => {
            job.status = "generating";
            job.error = null;
            persistBackgroundJobs();
            resumeBackgroundJobs();
            render();
          });
          const deleteBtn = button("Sil", "bg-job-delete-btn", () => {
            removeBackgroundJob(job.id);
            render();
          });
          actionsWrap.append(retryBtn, deleteBtn);
          row.append(main, meta, statusEl, actionsWrap);
        }

        list.appendChild(row);
      });

      const records = state.savedStrategies.filter((record) => !query || `${record.title} ${record.strategy?.summary || record.brief}`.toLocaleLowerCase("az").includes(query));

      if (!records.length && !matchingBgJobs.length) {
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
    view.appendChild(list);
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

/* ===== USAGE LIMITS VIEW & STATS ===== */

async function loadUsageStats() {
  try {
    const tzOffset = new Date().getTimezoneOffset();
    const data = await authRequest(`/api/usage/stats?tzOffset=${tzOffset}`);
    if (data && data.statsByPeriod) {
      state.usageStats = data;
      return data;
    }
  } catch (err) {
    console.warn("Could not fetch remote usage stats, computing locally:", err);
  }

  // Local fallback computation
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const periods = {
    today: { start: todayStart },
    "7d": { start: todayStart - 6 * DAY_MS },
    "14d": { start: todayStart - 13 * DAY_MS },
    "30d": { start: todayStart - 29 * DAY_MS },
  };

  const strats = state.savedStrategies || [];
  const chats = state.savedChats || [];
  const tasks = state.plannerTasks || [];

  const buildEvents = [];
  strats.forEach((s) => {
    const t = new Date(s.createdAt || s.updatedAt || Date.now()).getTime();
    buildEvents.push({ type: "strategy_create", timestamp: t });
    if (Array.isArray(s.versions)) {
      for (let i = 1; i < s.versions.length; i++) {
        buildEvents.push({
          type: "strategy_refine",
          timestamp: new Date(s.versions[i].createdAt || t).getTime(),
        });
      }
    }
  });

  const askEvents = [];
  chats.forEach((c) => {
    if (Array.isArray(c.messages)) {
      c.messages.forEach((m) => {
        const mt = new Date(m.createdAt || c.createdAt || Date.now()).getTime();
        if (m.role === "user") askEvents.push({ type: "ask_question", timestamp: mt });
        else if (m.role === "assistant") askEvents.push({ type: "ask_response", timestamp: mt });
      });
    }
  });

  const statsByPeriod = {};
  for (const [key, { start }] of Object.entries(periods)) {
    const pBuild = buildEvents.filter((e) => e.timestamp >= start);
    const pAsk = askEvents.filter((e) => e.timestamp >= start);
    const created = pBuild.filter((e) => e.type === "strategy_create").length;
    const refined = pBuild.filter((e) => e.type === "strategy_refine").length;
    const questions = pAsk.filter((e) => e.type === "ask_question").length;
    const responses = pAsk.filter((e) => e.type === "ask_response").length;
    statsByPeriod[key] = {
      totalOps: created + refined + questions + responses,
      build: { total: created + refined, strategiesCreated: created, refinements: refined },
      ask: { total: questions + responses, questions, responses, activeChats: chats.length },
      activeProjects: strats.length,
      plannerTasksCount: tasks.length,
    };
  }

  const dailyBreakdown = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = todayStart - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const d = new Date(dayStart);
    const dateStr = d.toLocaleDateString("az-AZ", { month: "short", day: "numeric" });
    const isoDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dayBuild = buildEvents.filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd).length;
    const dayAsk = askEvents.filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd).length;
    dailyBreakdown.push({
      date: isoDate,
      label: i === 0 ? "Bugün" : dateStr,
      build: dayBuild,
      ask: dayAsk,
      total: dayBuild + dayAsk,
    });
  }

  state.usageStats = {
    plan: {
      isUnlimited: true,
      planTitle: "Limitsiz İstifadə Planı",
      statusText: "Bütün AI Modelləri Aktivdir",
    },
    statsByPeriod,
    dailyBreakdown,
    totals: {
      allTimeStrategies: strats.length,
      allTimeChats: chats.length,
      allTimeTasks: tasks.length,
    },
  };

  return state.usageStats;
}

function renderLimitsView() {
  workspace.classList.add("workspace-limits");
  workspace.replaceChildren();

  if (!state.usageStats) {
    loadUsageStats().then(() => {
      if (state.view === "limits") renderLimitsView();
    });
  }

  const view = element("section", "limits-view");
  const period = state.limitsPeriod || "today";
  const stats = state.usageStats?.statsByPeriod?.[period] || {
    totalOps: 0,
    build: { total: 0, strategiesCreated: 0, refinements: 0 },
    ask: { total: 0, questions: 0, responses: 0 },
  };

  // 1. Header Row with Integrated Period Switcher
  const headerRow = element("div", "limits-header-row");
  const headerText = element("div", "limits-header-text");
  headerText.append(
    element("h1", "", "İstifadə limiti"),
    element("p", "", "Workspace daxilində AI istifadənizi və fəallığınızı izləyin.")
  );

  const headerControls = element("div", "limits-header-controls");

  // Desktop Period Segmented Filter
  const filterPills = element("div", "limits-segmented-control");
  const PERIOD_OPTIONS = [
    { id: "today", label: "Bugün" },
    { id: "7d", label: "7 gün" },
    { id: "14d", label: "14 gün" },
    { id: "30d", label: "30 gün" },
  ];

  PERIOD_OPTIONS.forEach(({ id, label }) => {
    const pill = button(label, `limits-segment-btn${period === id ? " is-active" : ""}`, () => {
      state.limitsPeriod = id;
      renderLimitsView();
    });
    filterPills.appendChild(pill);
  });

  // Mobile Native Select Dropdown
  const mobileSelectWrap = element("div", "limits-mobile-select-wrap");
  const mobileSelect = document.createElement("select");
  mobileSelect.className = "limits-mobile-select";
  mobileSelect.setAttribute("aria-label", "Dövr seçimi");
  PERIOD_OPTIONS.forEach(({ id, label }) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    if (period === id) opt.selected = true;
    mobileSelect.appendChild(opt);
  });
  mobileSelect.addEventListener("change", (e) => {
    state.limitsPeriod = e.target.value;
    renderLimitsView();
  });
  mobileSelectWrap.innerHTML = `
    <svg class="limits-select-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  `;
  mobileSelectWrap.prepend(mobileSelect);

  // Refresh Button
  const refreshBtn = button("", "limits-refresh-btn", async () => {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("is-loading");
    await loadUsageStats();
    if (state.view === "limits") renderLimitsView();
    showToast("Statistikalar yeniləndi ✓", "info");
  });
  refreshBtn.setAttribute("title", "Statistikanı yenilə");
  refreshBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  `;

  headerControls.append(filterPills, mobileSelectWrap, refreshBtn);
  headerRow.append(headerText, headerControls);
  view.appendChild(headerRow);

  // 2. Compact Unlimited Hero Banner
  const heroCard = element("div", "limits-hero-card");
  heroCard.innerHTML = `
    <div class="limits-hero-glow"></div>
    <div class="limits-hero-top">
      <div class="limits-status-pill">
        <span class="limits-pulse-dot"></span>
        <span class="limits-status-text">Limitsiz Plan</span>
      </div>
      <span class="limits-badge-tier">Aktiv</span>
    </div>
    <div class="limits-hero-body">
      <h2>Bütün AI modelləri limitsizdir</h2>
      <p>Build və Ask rejimlərində heç bir sorğu və ya kvota məhdudiyyəti yoxdur.</p>
    </div>
    <div class="limits-hero-chips">
      <div class="limits-chip">
        <div class="limits-chip-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <div class="limits-chip-content">
          <strong>Sorğu Limiti</strong>
          <span>Limitsiz (∞)</span>
        </div>
      </div>
      <div class="limits-chip">
        <div class="limits-chip-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <div class="limits-chip-content">
          <strong>Export</strong>
          <span>Limitsiz (∞)</span>
        </div>
      </div>
      <div class="limits-chip">
        <div class="limits-chip-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        </div>
        <div class="limits-chip-content">
          <strong>Layihə Yaddaşı</strong>
          <span>Limitsiz (∞)</span>
        </div>
      </div>
    </div>
  `;
  view.appendChild(heroCard);

  // 3. Two Clean Mode Cards (Build & Ask)
  const modeGrid = element("div", "limits-mode-grid");

  // Build Card
  const buildCard = element("div", "limits-mode-card mode-build-card");
  buildCard.innerHTML = `
    <div class="limits-mode-card-top">
      <div class="limits-mode-title-wrap">
        <div class="limits-mode-icon-box build-icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div>
          <h4>Build Rejimi</h4>
          <span class="limits-mode-sub">Strateji generasiya və dəqiqləşdirmə</span>
        </div>
      </div>
      <span class="limits-tag tag-build">Limitsiz</span>
    </div>
    <div class="limits-mode-value-wrap">
      <span class="limits-mode-big-num">${stats.build.total}</span>
      <span class="limits-mode-unit">əməliyyat</span>
    </div>
    <div class="limits-mode-meta-pills">
      <span class="limits-meta-pill"><strong>${stats.build.strategiesCreated}</strong> yeni strategiya</span>
      <span class="limits-meta-pill"><strong>${stats.build.refinements}</strong> dəqiqləşdirmə</span>
    </div>
  `;

  // Ask Card
  const askCard = element("div", "limits-mode-card mode-ask-card");
  askCard.innerHTML = `
    <div class="limits-mode-card-top">
      <div class="limits-mode-title-wrap">
        <div class="limits-mode-icon-box ask-icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        </div>
        <div>
          <h4>Ask Rejimi</h4>
          <span class="limits-mode-sub">İnteraktiv sual-cavab və analiz</span>
        </div>
      </div>
      <span class="limits-tag tag-ask">Limitsiz</span>
    </div>
    <div class="limits-mode-value-wrap">
      <span class="limits-mode-big-num">${stats.ask.total}</span>
      <span class="limits-mode-unit">əməliyyat</span>
    </div>
    <div class="limits-mode-meta-pills">
      <span class="limits-meta-pill"><strong>${stats.ask.questions}</strong> sual</span>
      <span class="limits-meta-pill"><strong>${stats.ask.responses}</strong> AI cavabı</span>
    </div>
  `;

  modeGrid.append(buildCard, askCard);
  view.appendChild(modeGrid);

  // 4. Activity Timeline Chart Card
  const chartSection = element("div", "limits-chart-card");
  const chartHeader = element("div", "limits-chart-header");
  const periodTitle = period === "today" ? "Bugün" : period === "7d" ? "Son 7 gün" : period === "14d" ? "Son 14 gün" : "Son 30 gün";
  chartHeader.innerHTML = `
    <div>
      <h3>Fəallıq Dinamikası</h3>
      <p>${escapeHtml(periodTitle)} üzrə sorğu və generasiyaların vizual bölgüsü.</p>
    </div>
    <div class="limits-chart-legend">
      <div class="legend-item"><span class="legend-dot dot-build"></span><span>Build</span></div>
      <div class="legend-item"><span class="legend-dot dot-ask"></span><span>Ask</span></div>
    </div>
  `;
  chartSection.appendChild(chartHeader);

  let chartData = state.usageStats?.dailyBreakdown || [];
  if (period === "today") chartData = chartData.slice(-1);
  else if (period === "7d") chartData = chartData.slice(-7);
  else if (period === "14d") chartData = chartData.slice(-14);
  else if (period === "30d") chartData = chartData.slice(-30);

  const totalDays = chartData.length;
  const maxTotal = Math.max(...chartData.map((d) => d.total || 0), 4);

  const chartBody = element("div", "limits-chart-body");
  const barsContainer = element("div", `limits-chart-bars-wrap${period === "today" ? " is-single-day" : ""}`);

  let labelStep = 1;
  if (totalDays > 20) labelStep = 5;
  else if (totalDays > 10) labelStep = 3;

  chartData.forEach((dayItem, idx) => {
    const col = element("div", "limits-chart-col");
    const isFirst = (idx === 0);
    const isLast = (idx === totalDays - 1);
    const isKeyStep = (idx % labelStep === 0);
    const showLabel = (totalDays <= 8) || isFirst || isLast || isKeyStep;

    const hasActivity = (dayItem.build > 0) || (dayItem.ask > 0);
    const buildH = dayItem.build > 0 ? Math.max(6, Math.round(((dayItem.build || 0) / maxTotal) * 110)) : 0;
    const askH = dayItem.ask > 0 ? Math.max(6, Math.round(((dayItem.ask || 0) / maxTotal) * 110)) : 0;

    let barsTrackHtml = "";
    if (hasActivity) {
      barsTrackHtml = `
        <div class="limits-col-bars-track">
          ${buildH > 0 ? `<div class="limits-bar-segment segment-build" style="height: ${buildH}px;"></div>` : ""}
          ${askH > 0 ? `<div class="limits-bar-segment segment-ask" style="height: ${askH}px;"></div>` : ""}
        </div>
      `;
    } else {
      barsTrackHtml = `
        <div class="limits-col-bars-track is-empty">
          <div class="limits-bar-empty"></div>
        </div>
      `;
    }

    const labelText = escapeHtml(dayItem.label.replace("Bu gün", "Bugün"));

    col.innerHTML = `
      <div class="limits-chart-tooltip">
        <strong>${labelText}</strong>
        <div class="tooltip-row"><span class="t-dot dot-build"></span> Build: ${dayItem.build || 0}</div>
        <div class="tooltip-row"><span class="t-dot dot-ask"></span> Ask: ${dayItem.ask || 0}</div>
        <div class="tooltip-row t-total">Cəmi: ${dayItem.total || 0}</div>
      </div>
      ${barsTrackHtml}
      <span class="limits-col-label${showLabel ? "" : " is-hidden-label"}">${showLabel ? labelText : "&nbsp;"}</span>
    `;
    barsContainer.appendChild(col);
  });

  chartBody.appendChild(barsContainer);
  chartSection.appendChild(chartBody);
  view.appendChild(chartSection);

  workspace.appendChild(view);
}

const LEGAL_DOCS = {
  terms: {
    title: "İstifadə Şərtləri",
    subtitle: "Son yenilənmə tarixi: Avqust 2026",
    html: `
      <div class="legal-highlight-box">
        <strong>✦ Süni İntellekt API İstifadəsi</strong>
        Marketify AI xidməti strateji analizləri və marketinq nəticələrini generasiya etmək üçün qabaqcıl süni intellekt və böyük dil modellərinin (LLM) rəsmi API infrastrukturları ilə fəaliyyət göstərir.
      </div>
      <h3>1. Ümumi Müddəalar və Xidmətin Təyinatı</h3>
      <p>Marketify AI platformasına (“Platforma”, “Xidmət”) xoş gəlmisiniz. Bu İstifadə Şərtləri (“Şərtlər”) sizin platformadan istifadənizi tənzimləyir. Xidmətdən istifadə etməklə siz bu şərtləri tam və qeyd-şərtsiz qəbul etmiş olursunuz.</p>
      
      <h3>2. Süni İntellekt Emalı və Təhlükəsizlik</h3>
      <p>Platformada daxil etdiyiniz biznes brifləri, cavablar və sorğular ən müasir süni intellekt modelləri vasitəsilə təhlil edilir. Bu proses təhlükəsiz və şifrələnmiş kanallarla həyata keçirilir.</p>
      <p>Marketify AI generasiya prosesində ən yüksək dəqiqlik və kontekstual uyğunluq təmin etmək üçün API sorğularını optimallaşdırır.</p>

      <h3>3. Əqli Mülkiyyət və Məzmun Hüquqları</h3>
      <p><strong>İstifadəçi Məlumatları:</strong> Daxil etdiyiniz bütün biznes ideyaları, məhsul detalları və fərdi qeydlər müstəsna olaraq sizə məxsusdur.</p>
      <p><strong>Generasiya Edilən Strategiyalar:</strong> Marketify AI vasitəsilə hazırladığınız bütün marketinq strategiyaları, fəaliyyət planları və sənədlər sizin sərəncamınızdadır və kommersiya və ya qeyri-kommersiya fəaliyyətinizdə sərbəst istifadə edilə bilər.</p>

      <h3>4. Məsuliyyətin Məhdudlaşdırılması və Tövsiyə Xarakteri</h3>
      <p>Süni intellekt tərəfindən generasiya olunan nəticələr, proqnozlar və fəaliyyət planları strateji bələdçi və məsləhət xarakteri daşıyır. Marketinq kampaniyalarının icrası, büdcə xərcləri və biznes qərarları üzrə yekun məsuliyyət istifadəçinin üzərindədir.</p>

      <h3>5. İstifadəçi Öhdəlikləri</h3>
      <p>İstifadəçilər qanunvericiliyə zidd, fırıldaqçılıq xarakterli və ya üçüncü şəxslərin hüquqlarını pozan sorğular göndərməməyi və sistemin fəaliyyətinə mane olmamağı öhdələrinə götürürlər.</p>
    `,
  },
  privacy: {
    title: "Məxfilik Siyasəti və Fərdi Məlumatların Emalı Qaydaları",
    subtitle: "Son yenilənmə tarixi: Avqust 2026",
    html: `
      <p>Bu Məxfilik Siyasəti (bundan sonra — <strong>«Siyasət»</strong>) <strong>Innova Group Azerbaijan</strong> tərəfindən idarə olunan <strong>Marketify AI</strong> platformasında (bundan sonra — <strong>«Platforma»</strong>, <strong>«Xidmət»</strong> və ya <strong>«Məlumat Sahibi/İdarəçi»</strong>) fərdi və konfidensial məlumatların toplanması, emalı, saxlanması və mühafizəsi qaydalarını müəyyən edir.</p>
      <p>Platformadan istifadə etməklə İstifadəçi Azərbaycan Respublikasının «Fərdi məlumatlar haqqında» Qanununa uyğun olaraq, öz fərdi məlumatlarının bu Siyasətdə göstərilən şərtlər daxilində toplanmasına və emalına tam razılığını bildirmiş olur.</p>

      <h3>1. Əsas Prinsiplər və Qeyri-Kommersiya Xarakteri</h3>
      <p>1.1. Platforma qeyri-kommersiya təyinatlı fəaliyyət göstərir və toplanan məlumatlardan birbaşa və ya dolayısı ilə kommersiya, reklam və ya mənfəət əldə etmək məqsədilə istifadə etmir.</p>
      <p>1.2. Məlumatların emalı qanunilik, konfidensiallıq, məqsədəuyğunluq və yalnız xidmətin texniki-funksional tələbləri ilə məhdudlaşma prinsiplərinə əsaslanır.</p>

      <h3>2. Toplanan Məlumatların Kateqoriyaları</h3>
      <p>Platforma xidmətlərin təmənnasız göstərilməsi və sistem təhlükəsizliyinin təmin edilməsi məqsədilə aşağıdakı kateqoriyalar üzrə məlumatları emal edir:</p>
      <p>2.1. <strong>İdentifikasiya və Giriş Məlumatları:</strong> İstifadəçinin adı, soyadı, istifadəçi adı, elektron poçt ünvanı və təhlükəsiz şifrələnmiş (kriptoqrafik heşlənmiş) autentifikasiya identifikatorları.</p>
      <p>2.2. <strong>Biznes və Məzmun Konteksti:</strong> İstifadəçi tərəfindən sistemə daxil edilən marketinq brifləri, aydınlaşdırma sorğularına cavablar, generasiya olunmuş analitik nəticələr, söhbət tarixçəsi, planlaşdırılan tapşırıqlar və arxiv qeydləri.</p>
      <p>2.3. <strong>Texniki və Təhlükəsizlik Göstəriciləri:</strong> İstifadəçinin brauzer sessiya açarları, IP ünvanları, sistem hadisələrinin qeydiyyat jurnalları (server logları) və giriş vaxtı göstəriciləri.</p>

      <h3>3. Fərdiləşdirilmiş Təcrübə, Həssas Məlumatlar və İstifadəçinin Mülahizə Öhdəliyi</h3>
      <p>3.1. <strong>Könüllü Razılıq və Fərdiləşdirmə:</strong> Platformada süni intellekt cavablarının daha dəqiq, kontekstə uyğun və effektiv formalaşdırılması məqsədilə «Fərdiləşdirilmiş təcrübə» funksiyası tətbiq olunur. Bu funksiya yalnız İstifadəçinin birmənalı və könüllü razılığı (opt-in) əsasında aktivləşdirilir və istənilən vaxt sistem parametrlərindən söndürülə bilər.</p>
      <p>3.2. <strong>Həssas Məlumatların Yaddaşda Saxlanılmaması:</strong> Fərdiləşdirmə mexanizmi çərçivəsində İstifadəçinin həssas və birbaşa identifikasiyaedici şəxsi məlumatları, o cümlədən mobil telefon nömrəsi, dəqiq yaşayış ünvanı məlumatları, şəxsiyyəti təsdiq edən sənədin fərdi identifikasiya nömrəsi (FİN kod), seriya və nömrəsi, habelə bank və ödəniş rekvizitləri qəti şəkildə fərdiləşdirmə yaddaşında saxlanılmır və profil kontekstinə daxil edilmir. Fərdiləşdirmə yalnız qeyri-həssas, ümumi üslub və marketinq konteksti parametrlərini əhatə edir.</p>
      <p>3.3. <strong>İstifadəçinin Mülahizəsi və Paylaşmamaq Məsuliyyəti:</strong> Qanunvericilikdə və ya xidmətin qeydiyyat formasında birbaşa tələb olunan məcburi texniki hallar (məsələn, hesabın yaradılması üçün e-poçt ünvanı) istisna olmaqla, sorğulara daxil edilən hər hansı məlumatın həcmi və xarakteri üzrə yekun mülahizə tam şəkildə İstifadəçinin öz üzərindədir. İstifadəçilər platformanın heç bir interfeysində, sorğu və ya brif daxiletmə sahələrində həssas fərdi məlumatlarını, dövlət qeydiyyat nömrələrini, bank rekvizitlərini və ya üçüncü şəxslərin gizli məlumatlarını heç bir halda paylaşmamalı və sistemə daxil etməməlidirlər. İstifadəçinin bu tələbə zidd olaraq öz təşəbbüsü ilə paylaşdığı həssas məlumatlara görə Platforma heç bir maddi və ya hüquqi məsuliyyət daşımır.</p>

      <h3>4. Süni İntellekt API İnteqrasiyası və Məlumatların Transsərhəd Emalı</h3>
      <p>4.1. Platforma strateji təhlil və mətn generasiyası funksiyalarını yerinə yetirmək üçün etibarlı qlobal süni intellekt provayderlərinin rəsmi Tətbiqi Proqramlaşdırma İnterfeyslərindən (API) istifadə edir.</p>
      <p>4.2. Sorğular təhlükəsiz TLS/HTTPS şifrələmə protokolları vasitəsilə ötürülür və yalnız cari generasiya sessiyasının tələblərini icra etmək üçün emal olunur.</p>
      <p>4.3. <strong>Model Təlimindən İmtiyaz:</strong> İstifadəçinin daxil etdiyi biznes sorğuları, fərdi məlumatları və ya fərdiləşdirmə parametrləri üçüncü tərəf süni intellekt modellərinin açıq təlimi (public training) üçün istifadə edilmir.</p>
      <p>4.4. <strong>Məlumatların Satılmaması Təminatı:</strong> Innova Group Azerbaijan heç bir halda istifadəçilərin şəxsi identifikasiya məlumatlarını, əlaqə vasitələrini və ya biznes kontekstini reklam şirkətlərinə, marketinq agentliklərinə və ya digər kommersiya qurumlarına satmır, icarəyə vermir və ötürmür.</p>

      <h3>5. Məlumatların Saxlanması, İnfrastruktur və Təhlükəsizlik</h3>
      <p>5.1. Məlumatların bütövlüyü və konfidensiallığı müasir bulud saxlanc infrastrukturları (Cloudflare R2), operativ keşləmə mexanizmləri (Redis) və gücləndirilmiş server mühiti vasitəsilə təmin edilir.</p>
      <p>5.2. Məlumat bazalarına icazəsiz girişin, məlumat sızmasının və ya dəyişdirilməsinin qarşısını almaq üçün Azərbaycan Respublikasının «İnformasiya, informasiyalaşdırma və informasiyanın mühafizəsi haqqında» Qanununun tələblərinə uyğun təşkilati və proqram-texniki mühafizə tədbirləri tətbiq olunur.</p>

      <h3>6. İstifadəçinin Hüquqları və Məlumatların Silinməsi</h3>
      <p>Azərbaycan Respublikasının «Fərdi məlumatlar haqqında» Qanununa əsasən, İstifadəçi aşağıdakı hüquqlara malikdir:</p>
      <p>6.1. Öz fərdi məlumatlarının emal edilib-edilməməsi barədə məlumat almaq və onların tərkibi ilə tanış olmaq;</p>
      <p>6.2. Saxlanılan marketinq strategiyalarını, söhbət tarixçəsini, planlaşdırılan tapşırıqları və fərdiləşdirmə yaddaşını platformanın daxili interfeysi vasitəsilə istənilən vaxt tamamilə və bərpa olunmaz şəkildə silmək;</p>
      <p>6.3. «Fərdiləşdirilmiş təcrübə» funksiyasına verdiyi razılığı istədiyi an geri çağırmaq və sistemdəki profilinin tam ləğv edilməsini (unudulma hüququnu) tələb etmək.</p>

      <h3>7. Siyasətin Dəyişdirilməsi</h3>
      <p>7.1. Innova Group Azerbaijan qanunvericilikdəki dəyişikliklər və ya platformanın texniki təkamülü ilə əlaqədar bu Siyasətə birtərəfli qaydada dəyişikliklər etmək hüququnu özündə saxlayır.</p>
      <p>7.2. Yenilənmiş Siyasət Platformada dərc edildiyi andan qüvvəyə minir.</p>

      <h3>8. Əlaqə və Müraciətlər</h3>
      <p>Fərdi məlumatların emalı, məxfilik hüquqlarının həyata keçirilməsi və ya bu Siyasətlə bağlı müraciətlər üçün İstifadəçilər Platformanın rəsmi əks-əlaqə kanalları və rəqəmsal dəstək interfeysi vasitəsilə əlaqə saxlaya bilərlər.</p>
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

function openDeleteAccountModal() {
  const overlay = document.querySelector("#legalModalOverlay");
  if (!overlay) return;

  overlay.replaceChildren();
  const card = element("div", "legal-modal-card delete-account-modal-card");

  const header = element("header", "legal-modal-header");
  const titleGroup = element("div", "legal-modal-title-group");
  titleGroup.append(
    element("h2", "", "Hesabın silinməsini təsdiqləyirsiniz?"),
    element("p", "", "14 günlük təhlükəsizlik və gözləmə müddəti")
  );

  const closeBtn = button("✕", "legal-modal-close", closeLegalModal);
  closeBtn.setAttribute("aria-label", "Bağla");
  header.append(titleGroup, closeBtn);

  const body = element("div", "legal-modal-body delete-account-modal-body");
  body.innerHTML = `
    <div class="delete-account-callout">
      <div class="delete-callout-icon">⚠️</div>
      <div class="delete-callout-copy">
        <strong>Hesabınız dərhal silinmir.</strong> 14 günlük təhlükəsiz gözləmə müddəti tətbiq olunur.
      </div>
    </div>
    <div class="delete-rules-container">
      <div class="delete-rule-item">
        <span class="delete-rule-bullet">1</span>
        <div>
          <strong>Dərhal deaktivasiya:</strong>
          <p>Təsdiq etdiyiniz an cari sessiyanız bağlanacaq və hesabınız təhlükəsiz gözləmə rejiminə keçəcək.</p>
        </div>
      </div>
      <div class="delete-rule-item">
        <span class="delete-rule-bullet">2</span>
        <div>
          <strong>14 gün ərzində avtomatik bərpa:</strong>
          <p>14 gün ərzində fikrinizi dəyişsəniz, sadəcə hesabınıza yenidən daxil olmaqla silinməni ləğv edə və hesabınızı tam bərpa edə bilərsiniz.</p>
        </div>
      </div>
      <div class="delete-rule-item">
        <span class="delete-rule-bullet">3</span>
        <div>
          <strong>14 gündən sonra dönməz silinmə:</strong>
          <p>14 gün ərzində heç bir giriş edilməzsə, bütün marketinq strategiyalarınız, çatlar, planlaşdırıcı qeydləriniz və profiliniz birdəfəlik silinəcək.</p>
        </div>
      </div>
    </div>
  `;

  const footer = element("div", "legal-modal-footer delete-modal-footer");
  const cancelBtn = button("İmtina et", "secondary-button", closeLegalModal);
  const confirmBtn = button("Bəli, silinmə sorğusu göndər", "danger-button delete-confirm-btn", async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Silinmə tələb edilir…";
    try {
      await authRequest("/api/auth/account/delete-request", { method: "POST" });
      closeLegalModal();
      state.currentUser = null;
      showToast("Hesabınız 14 günlük silinmə rejiminə keçirildi. 14 gün ərzində daxil olmasanız, hesabınız birdəfəlik silinəcək.", "info");
      window.dispatchEvent(new CustomEvent("marketify:auth-required"));
    } catch (err) {
      showToast(err.message || "Xəta baş verdi.", "error");
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Bəli, silinmə sorğusu göndər";
    }
  });

  footer.append(cancelBtn, confirmBtn);
  card.append(header, body, footer);
  overlay.appendChild(card);
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

window.addEventListener("marketify:account-restored", () => {
  showToast("Xoş gəldiniz! 14 günlük silinmə sorğusu ləğv edildi və hesabınız bərpa olundu.", "success");
});

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
railLimitsButton?.addEventListener("click", () => {
  state.mode = "build";
  state.view = "limits";
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
limitsNav?.addEventListener("click", () => {
  state.mode = "build";
  state.view = "limits";
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

function checkPrivacyPolicyBanner() {
  const STORAGE_KEY = "marketify_privacy_notice_2026_08";
  if (localStorage.getItem(STORAGE_KEY) === "acknowledged") return;
  if (document.querySelector("#privacyNoticeToast")) return;

  const toast = element("aside", "privacy-notice-toast");
  toast.id = "privacyNoticeToast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const header = element("div", "privacy-notice-header");
  const badge = element("div", "privacy-notice-badge");
  badge.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    <span>Məxfilik siyasətimiz yeniləndi</span>
  `;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "acknowledged");
    toast.classList.add("is-dismissing");
    setTimeout(() => toast.remove(), 260);
  };

  const closeBtn = button("✕", "privacy-notice-close", dismiss);
  closeBtn.setAttribute("aria-label", "Bağla");
  header.append(badge, closeBtn);

  const body = element(
    "p",
    "privacy-notice-body",
    "Məlumatlarınızın təhlükəsizliyini və şəffaflığı artırmaq üçün Məxfilik Siyasətimizi yenilədik. Şərtlərlə tanış ola bilərsiniz. Əgər yenilənmiş şərtlər sizin üçün uyğun deyilsə, istədiyiniz vaxt Təhlükəsizlik bölməsindən hesabınızı silə bilərsiniz."
  );

  const actions = element("div", "privacy-notice-actions");
  const readBtn = button("Siyasətlə tanış ol →", "secondary-button privacy-notice-read-btn", () => {
    openLegalModal("privacy");
  });
  readBtn.type = "button";

  const ackBtn = button("Anladım", "primary-button privacy-notice-ack-btn", dismiss);
  ackBtn.type = "button";

  actions.append(readBtn, ackBtn);
  toast.append(header, body, actions);

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });
}

initializeAuthentication(async (user) => {
  updateWorkspaceIdentity(user);
  resumeBackgroundJobs();
  render();
  await Promise.allSettled([loadSavedStrategies(), loadSavedChats(), loadPlannerTasks(), loadUsageStats()]);
  if (window.location.hash === "#terms" || window.location.pathname === "/terms") {
    openLegalModal("terms");
  } else if (window.location.hash === "#privacy" || window.location.pathname === "/privacy") {
    openLegalModal("privacy");
  }
  checkPrivacyPolicyBanner();
});
