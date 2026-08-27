import { createDocumentExport, createExcelExport, createSpreadsheetExport, exportStrategyToPDF } from "./exporters.js";
import { authRequest, initializeAuthentication, logout } from "./auth.js";
import { PRESET_PROMPTS } from "./preset-prompts.js";

const workspace = document.querySelector("#workspace");
const sidebar = document.querySelector("#sidebar");
const mobileOverlay = document.querySelector("#mobileOverlay");
const mobileMenuButton = document.querySelector("#mobileMenuButton");
const mobileNewButton = document.querySelector("#mobileNewButton");
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
const mobileModeSwitch = document.querySelector(".mobile-mode-switch");
const sidebarBuildModeButton = document.querySelector("#sidebarBuildModeButton");
const sidebarAskModeButton = document.querySelector("#sidebarAskModeButton");
const keyboardShortcutsButton = document.querySelector("#keyboardShortcutsBtn");
const keyboardShortcutsOverlay = document.querySelector("#keyboardShortcutsOverlay");

const KEYBOARD_SHORTCUTS = [
  { label: "Yeni strategiya və ya söhbət", mac: "⌘ ⌥ N", windows: "Ctrl Alt N", action: () => newStrategyButton?.click() },
  { label: "Başlanğıc", mac: "⌘ 1", windows: "Ctrl 1", action: () => homeNav?.click() },
  { label: "Arxiv", mac: "⌘ 2", windows: "Ctrl 2", action: () => strategiesNav?.click() },
  { label: "Planlaşdırılanlar", mac: "⌘ 3", windows: "Ctrl 3", action: () => plannerNav?.click() },
  { label: "Parametrlər", mac: "⌘ ,", windows: "Ctrl ,", action: () => settingsNav?.click() },
  { label: "Build və Ask rejimi arasında keçid", mac: "⌘ ⇧ A", windows: "Ctrl ⇧ A", action: () => setMode(state.mode === "build" ? "ask" : "build") },
  { label: "Bu pəncərəni bağla", mac: "Esc", windows: "Esc", action: () => closeShortcutModal() },
];

function isMacPlatform() {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

function shortcutSuffix(macShortcut, windowsShortcut) {
  return ` · ${isMacPlatform() ? macShortcut : windowsShortcut}`;
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

function createShortcutKey(value) {
  return element("kbd", "shortcut-key", value);
}

function openShortcutModal() {
  if (!keyboardShortcutsOverlay || window.innerWidth <= 767) return;

  keyboardShortcutsOverlay.replaceChildren();
  const card = element("div", "keyboard-shortcuts-card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "keyboardShortcutsTitle");

  const header = element("header", "keyboard-shortcuts-header");
  const titleGroup = element("div", "keyboard-shortcuts-title-group");
  const title = element("h2", "", "Klaviatura qısayolları");
  title.id = "keyboardShortcutsTitle";
  titleGroup.append(title, element("p", "", `${isMacPlatform() ? "macOS" : "Windows/Linux"} üçün sürətli idarəetmə`));

  const closeButton = button("✕", "keyboard-shortcuts-close", closeShortcutModal);
  closeButton.setAttribute("aria-label", "Qısayollar pəncərəsini bağla");
  header.append(titleGroup, closeButton);

  const body = element("div", "keyboard-shortcuts-body");
  const table = element("div", "keyboard-shortcuts-list");
  table.setAttribute("role", "list");
  KEYBOARD_SHORTCUTS.forEach((shortcut) => {
    const row = element("div", "keyboard-shortcut-row");
    row.setAttribute("role", "listitem");
    const copy = element("div", "keyboard-shortcut-copy");
    copy.appendChild(element("strong", "", shortcut.label));
    const keys = element("div", "keyboard-shortcut-keys");
    keys.append(createShortcutKey(shortcut.mac), element("span", "keyboard-shortcut-or", "və"), createShortcutKey(shortcut.windows));
    row.append(copy, keys);
    table.appendChild(row);
  });
  body.append(table, element("p", "keyboard-shortcuts-hint", "Qısayollar mətn sahəsində yazarkən də işləyir. Bu siyahını açmaq üçün ⌘/Ctrl + / və ya ? bas."));

  card.append(header, body);
  keyboardShortcutsOverlay.appendChild(card);
  keyboardShortcutsOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  closeButton.focus();
}

function closeShortcutModal() {
  if (!keyboardShortcutsOverlay) return;
  keyboardShortcutsOverlay.hidden = true;
  keyboardShortcutsOverlay.replaceChildren();
  if (document.querySelector("#legalModalOverlay[hidden]")) document.body.style.overflow = "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAskMessageModelInfo(model) {
  const normalized = typeof model === "string" ? model.trim().toLowerCase() : "";
  if (normalized.includes("gemini") || normalized === "flash") {
    return {
      isGemini: true,
      isTerra: false,
      displayName: "Flash",
    };
  }
  // Support existing saved messages while only rendering product-friendly labels.
  const isTerra = normalized === "terra" || /gpt[-\s]?5\.6[-\s]?terra/.test(normalized);
  const displayName = isTerra ? "Dərin Analiz" : "Auto";
  return {
    isGemini: false,
    isTerra,
    displayName,
  };
}

function formatFileSize(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return "0 B";
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIconSvg(mimeType = "", fileName = "") {
  const ext = String(fileName || "").split(".").pop()?.toLowerCase() || "";
  const mime = String(mimeType || "").toLowerCase();

  if (ext === "pdf" || mime.includes("pdf")) {
    return `<svg class="ask-file-type-icon is-pdf" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h2a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H8v4zm1-3h1v1H9v-1zm4 3h1.5a1.5 1.5 0 0 0 1.5-1.5v-1a1.5 1.5 0 0 0-1.5-1.5H13v4zm1-3h.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H14v-2z"/></svg>`;
  }
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "heic", "svg"].includes(ext)) {
    return `<svg class="ask-file-type-icon is-image" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  }
  if (["csv", "xlsx", "xls"].includes(ext) || mime.includes("sheet") || mime.includes("csv") || mime.includes("excel")) {
    return `<svg class="ask-file-type-icon is-sheet" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`;
  }
  if (["js", "ts", "json", "py", "html", "css", "sql", "md", "txt", "xml", "yaml", "yml"].includes(ext) || mime.includes("text") || mime.includes("json")) {
    return `<svg class="ask-file-type-icon is-code" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
  }
  return `<svg class="ask-file-type-icon is-doc" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
}

async function readUploadedFileAsData(file) {
  if (!file) return null;
  const maxBytes = 20 * 1024 * 1024; // 20MB
  if (file.size > maxBytes) {
    throw new Error("Faylın həcmi 20MB-dan çox ola bilməz.");
  }

  const isTextLike = (file.type && file.type.startsWith("text/")) ||
    ["txt", "md", "csv", "json", "js", "ts", "py", "html", "css", "sql", "xml", "yaml", "yml"].includes(
      file.name.split(".").pop()?.toLowerCase() || ""
    );

  let textContent;
  if (isTextLike) {
    textContent = await new Promise((resolve) => {
      const textReader = new FileReader();
      textReader.onload = () => resolve(String(textReader.result || ""));
      textReader.onerror = () => resolve("");
      textReader.readAsText(file);
    });
  }

  const base64Data = await new Promise((resolve, reject) => {
    const dataReader = new FileReader();
    dataReader.onload = () => {
      const res = String(dataReader.result || "");
      const raw = res.replace(/^data:[^;]+;base64,/, "");
      resolve(raw);
    };
    dataReader.onerror = () => reject(new Error("Fayl oxuna bilmədi."));
    dataReader.readAsDataURL(file);
  });

  return {
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    mimeType: file.type || "application/octet-stream",
    data: base64Data,
    textContent,
  };
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
let refinementPlaceholderTimer = null;

const state = {
  mode: (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("mode");
      if (requested === "ask" || requested === "build") return requested;
      const saved = localStorage.getItem("marketify_default_mode");
      if (saved === "ask" || saved === "build") return saved;
    } catch {}
    return "build";
  })(),
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
  buildStreamingText: "",
  buildStreamingFinishReason: null,
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
  plannerCollapsedGroups: new Set(["Ümumi"]),
  askMessages: [],
  askLoading: false,
  askError: "",
  askPendingFile: null,
  askStrategyId: "",
  askTaskId: "",
  askPromptHintStrategyId: "",
  askModel: (() => {
    try {
      const saved = localStorage.getItem("marketify_ask_model");
      if (saved === "gemini-3.7-flash" || saved === "auto") return saved;
    } catch {}
    return "auto";
  })(),
  askThinking: (() => {
    try {
      const saved = localStorage.getItem("marketify_ask_thinking");
      if (saved === "true") return true;
      if (saved === "false") return false;
    } catch {}
    return false;
  })(),
  strategyAskOpen: false,
  refinementOpen: false,
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
    const safeMessage = data.error || (path === "/api/ask"
      ? "Cavabı hazırlamaq mümkün olmadı."
      : "Strategiyanı hazırlamaq mümkün olmadı. Bir neçə saniyə sonra yenidən yoxla.");
    const error = new Error(safeMessage);
    error.code = data.code;
    error.status = response.status;
    error.model = data.model;
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
  homeNav.classList.toggle("is-active", !nonHomeViews.includes(state.view));
  strategiesNav.classList.toggle("is-active", state.view === "list");
  plannerNav?.classList.toggle("is-active", state.view === "planner");
  limitsNav?.classList.toggle("is-active", state.view === "limits");
  settingsNav.classList.toggle("is-active", state.view === "settings");
  railHomeButton.classList.toggle("is-active", !nonHomeViews.includes(state.view));
  railStrategiesButton.classList.toggle("is-active", state.view === "list");
  railPlannerButton?.classList.toggle("is-active", state.view === "planner");
  railLimitsButton?.classList.toggle("is-active", state.view === "limits");

  railHomeButton.setAttribute("data-tooltip", `Başlanğıc${shortcutSuffix("⌘ 1", "Ctrl 1")}`);
  railStrategiesButton.setAttribute("data-tooltip", `Arxiv${shortcutSuffix("⌘ 2", "Ctrl 2")}`);
  railPlannerButton?.setAttribute("data-tooltip", `Planlaşdırılanlar${shortcutSuffix("⌘ 3", "Ctrl 3")}`);
  railLimitsButton?.setAttribute("data-tooltip", "İstifadə limiti");

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
  if (state.mode === "ask") {
    return !state.askMessages.length && !state.askLoading;
  }
  return false;
}

function syncMode() {
  const isBuild = state.mode === "build";
  const isHome = isHomePage();
  const isAskChatActive = state.mode === "ask" && state.view === "home" && Boolean(state.askMessages?.length || state.askLoading);

  if (mobileModeSwitch) {
    mobileModeSwitch.hidden = !isHome;
  }

  if (mobileNewButton) {
    mobileNewButton.hidden = !isAskChatActive;
  }

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
      `${isBuild ? "Rejim: Build (Ask-a keç)" : "Rejim: Ask (Build-ə keç)"}${shortcutSuffix("⌘ ⇧ A", "Ctrl ⇧ A")}`,
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
  if (!['build', 'ask'].includes(mode)) return;
  try {
    localStorage.setItem("marketify_default_mode", mode);
  } catch {}
  if (state.mode === mode && state.view === "home") return;
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
  state.askTaskId = "";
  state.askPromptHintStrategyId = "";
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
    strategyAskOpen: false,
    refinementOpen: false,
  });
  render();
  closeSidebar();
}

function render() {
  clearInterval(progressTimer);
  clearInterval(loadingAskPlaceholderTimer);
  clearTimeout(refinementPlaceholderTimer);
  syncMode();
  syncNav();
  document.querySelectorAll(".loading-top-actions, #loadingTopActions, .loading-history-button, #analysisHistoryBtn, .loading-ask-floating-wrap, #loadingAskFloatingWrap, .loading-ask-modal-overlay").forEach((btn) => btn.remove());
  workspace.replaceChildren();
  workspace.className = "workspace";

  if (state.view === "settings") return renderSettings();
  if (state.view === "planner") return renderPlannerView();
  if (state.view === "limits") return renderLimitsView();
  if (state.view === "list") return renderStrategyList();
  if (state.mode === "ask") return renderAsk();
  if (["analyzing", "generating"].includes(state.status)) return renderLoading();
  if (state.status === "needs_clarification") return renderClarification();
  if (state.strategy) return renderStrategyWorkspace();
  return renderIntake();
}

const BUILD_CTA_LIST = [
  "Növbəti strategiyanı quraq.",
  "Yeni marketinq hədəfin nədir?",
  "Brendini böyütmək üçün başlayaq.",
  "Satışları artırmaq üçün ideyanı yaz.",
  "Yeni məhsulunu bazara çıxaraq.",
  "Kampaniyanı planlaşdıraq.",
  "Rəqiblərdən fərqlənən plan quraq.",
];

const ASK_CTA_LIST = [
  "Nə haqda düşünürsən?",
  "Marketinq sualını ver.",
  "Hansı metrikanı analiz edək?",
  "Rəqibləri və bazarı araşdıraq?",
  "Biznes ideyanı birlikdə müzakirə edək.",
  "Bugünkü hədəfin nədir?",
  "Kampaniyanı necə optimallaşdıraq?",
];

const selectedBuildCta = BUILD_CTA_LIST[Math.floor(Math.random() * BUILD_CTA_LIST.length)];
const selectedAskCta = ASK_CTA_LIST[Math.floor(Math.random() * ASK_CTA_LIST.length)];

function appendPresetPrompt(input, prompt, onChange) {
  const current = input.value.trim();
  input.value = current ? `${current}\n\n${prompt}` : prompt;
  onChange();
  input.focus();
}

function addPresetPromptPane(popover, mode, onSelect, onBack) {
  const header = element("div", "ask-context-menu-subheader");
  const back = button("‹", "ask-context-menu-back", onBack);
  back.setAttribute("aria-label", "Kontekst menyusuna qayıt");
  header.append(back, element("strong", "ask-context-menu-heading", "Hazır sual"));
  popover.appendChild(header);

  const list = element("div", "preset-prompt-list");
  PRESET_PROMPTS[mode].forEach((prompt) => {
    const item = button("", "preset-prompt-item", () => onSelect(prompt.text));
    item.append(element("strong", "", prompt.title), element("span", "", prompt.text));
    list.appendChild(item);
  });
  popover.appendChild(list);
}

function renderIntake() {
  workspace.classList.add("workspace-ask", "workspace-intake", "is-empty");

  const shell = element("section", "ask-shell is-empty");
  shell.setAttribute("aria-labelledby", "intakeTitle");

  const thread = element("div", "ask-thread");
  const intro = element("div", "ask-intro");
  const title = element("h1", "ask-title", selectedBuildCta);
  title.id = "intakeTitle";
  intro.append(title);
  thread.appendChild(intro);

  const composerArea = element("div", "ask-composer-area");
  const form = element("form", "ask-composer");
  const label = element("label", "sr-only", "Strategiya brifi");
  label.htmlFor = "briefInput";

  const textarea = element("textarea", "ask-input");
  textarea.id = "briefInput";
  textarea.name = "brief";
  textarea.rows = 1;
  textarea.maxLength = 8000;
  textarea.placeholder = "Marketify ilə strategiya qur";
  textarea.value = state.brief;

  const submit = button("", "ask-submit");
  submit.type = "submit";
  submit.disabled = state.brief.trim().length < 8;
  submit.setAttribute("aria-label", "Strategiyanı qur");
  submit.appendChild(element("span", "", "↑"));

  const composerActions = element("div", "ask-composer-actions");
  composerActions.append(submit);

  const contextMenu = document.createElement("details");
  contextMenu.className = "ask-context-menu";
  const contextTrigger = element("summary", "ask-context-trigger");
  contextTrigger.setAttribute("aria-label", "Əlavə seçimlər");
  contextTrigger.title = "Əlavə seçimlər";
  contextTrigger.appendChild(element("span", "ask-context-plus", "+"));
  const contextPopover = element("div", "ask-context-popover");
  let contextPane = "main";
  const drawBuildMenu = () => {
    contextPopover.replaceChildren();
    if (contextPane === "prompts") {
      contextPopover.classList.add("is-downwards");
      addPresetPromptPane(contextPopover, "build", (prompt) => {
        contextMenu.open = false;
        contextPane = "main";
        contextPopover.classList.remove("is-downwards");
        appendPresetPrompt(textarea, prompt, resizeInput);
      }, () => {
        contextPane = "main";
        contextPopover.classList.remove("is-downwards");
        drawBuildMenu();
      });
      return;
    }
    contextPopover.classList.remove("is-downwards");
    contextPopover.appendChild(element("strong", "ask-context-menu-heading", "Əlavə et"));
    const option = button("", "ask-context-menu-option", () => {
      contextPane = "prompts";
      drawBuildMenu();
    });
    const copy = element("span", "ask-context-menu-option-copy");
    copy.append(element("strong", "", "Hazır sual"), element("small", "", "Başlamaq üçün hazır prompt seç"));
    option.append(copy, element("span", "ask-context-menu-chevron", "›"));
    contextPopover.appendChild(option);
  };
  drawBuildMenu();
  contextMenu.append(contextTrigger, contextPopover);
  const closeContextMenu = (event) => {
    const path = event.composedPath ? event.composedPath() : [];
    if (path.includes(contextMenu) || contextMenu.contains(event.target)) return;
    contextMenu.open = false;
  };
  contextMenu.addEventListener("toggle", () => {
    if (contextMenu.open) {
      setTimeout(() => {
        document.addEventListener("pointerdown", closeContextMenu);
      }, 0);
    } else {
      document.removeEventListener("pointerdown", closeContextMenu);
      contextPane = "main";
      contextPopover.classList.remove("is-downwards");
      drawBuildMenu();
    }
  });

  form.append(contextMenu, label, textarea, composerActions);

  const helper = element("div", "ask-composer-meta");
  const disclaimer = element("p", "ask-disclaimer", "Marketify süni intellekt funksiyası yerinə yetirir və səhvlər edə bilər.");
  helper.appendChild(disclaimer);

  composerArea.append(form, helper);

  const resizeInput = () => {
    state.brief = textarea.value;
    submit.disabled = textarea.value.trim().length < 8;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  };
  textarea.addEventListener("input", resizeInput);
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

  const banner = errorBanner();
  if (banner) shell.appendChild(banner);

  shell.append(thread, composerArea);
  workspace.appendChild(shell);
  if (window.innerWidth > 767) setTimeout(() => textarea.focus(), 0);
}

function appendAskInline(parent, value) {
  const parts = String(value).split(/(\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|`[^`]+`)/g).filter(Boolean);
  parts.forEach((part) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      parent.appendChild(element("strong", "", part.slice(2, -2)));
    } else if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) || (part.startsWith("_") && part.endsWith("_") && part.length > 2)) {
      parent.appendChild(element("em", "", part.slice(1, -1)));
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

    if (/^[-*_]{3,}$/.test(line)) {
      root.appendChild(element("hr", "ask-divider"));
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

async function recordLearningSignal(interactionId, signal) {
  if (!interactionId) return;
  try {
    await fetch(`/api/learning/signals/${encodeURIComponent(interactionId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signal),
      keepalive: true,
    });
  } catch (error) {
    console.warn("Learning signal could not be recorded:", error?.message || error);
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
  const isAuto = state.askModel === "auto" || !state.askModel;
  workspace.classList.add("workspace-ask");
  const isChatActive = Boolean(state.askMessages.length || state.askLoading);
  workspace.classList.toggle("has-messages", isChatActive);
  workspace.classList.toggle("is-empty", !isChatActive);

  const selectedStrategy = state.savedStrategies.find((strategy) => strategy.id === state.askStrategyId) || null;
  const selectedTask = state.plannerTasks.find((task) => task.id === state.askTaskId) || null;
  if (state.askTaskId && !selectedTask) state.askTaskId = "";
  const shell = element("section", `ask-shell${isChatActive ? " has-messages" : " is-empty"}`);
  shell.setAttribute("aria-label", "Ask");
  const thread = element("div", "ask-thread");

  if (!state.askMessages.length) {
    const intro = element("div", "ask-intro");
    const title = element("h1", "ask-title", selectedAskCta);
    intro.append(title);
    thread.appendChild(intro);
  } else {
    state.askMessages.forEach((message, messageIndex) => {
      const isFreshResponse = message.role === "assistant" && freshAskResponses.has(message);
      const isStreamingMsg = Boolean(message.isStreaming);
      const row = element("article", `ask-message ask-message-${message.role}${isFreshResponse ? " is-fresh" : ""}${isStreamingMsg ? " is-streaming" : ""}`);
      const content = element("div", "ask-message-content");
      if (message.role === "assistant") {
        if (isStreamingMsg && !message.content) {
          const isSearching = message.status === "searching";
          const thinking = element("div", `ask-thinking${isSearching ? " is-searching" : ""}`);
          const iconWrap = element("span", "ask-thinking-icon");
          if (isSearching) {
            iconWrap.innerHTML = `
              <svg class="ask-searching-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            `;
          } else {
            iconWrap.innerHTML = `
              <svg class="ask-thinking-sparkle" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"/>
              </svg>
            `;
          }
          const modelInfo = getAskMessageModelInfo(message.model);
          const isThinkingActive = modelInfo.isGemini ? Boolean(state.askThinking) : modelInfo.isTerra;
          let label = isThinkingActive ? (modelInfo.isGemini ? "Marketify düşünür" : "Dərin analiz") : "Cavab hazırlanır";
          if (isSearching || message.statusText) {
            label = message.statusText || "Veb axtarışı...";
          }
          const thinkingLabel = element("span", "ask-thinking-label", label);
          const dots = element("span", "ask-thinking-dots");
          dots.append(element("i"), element("i"), element("i"));
          thinking.append(iconWrap, thinkingLabel, dots);
          content.appendChild(thinking);
        } else {
          content.appendChild(renderAskRichText(message.content));
          if (isStreamingMsg) {
            const caret = element("span", "ask-answer-caret is-streaming");
            content.appendChild(caret);
          }
        }

        if (!isStreamingMsg && message.content) {
          const actions = element("div", "ask-message-actions");
          actions.setAttribute("aria-label", "Cavab əməliyyatları");

          const copy = button("", "ask-response-action ask-response-copy-btn", async () => {
            const ok = await copyAskResponse(message.content);
            if (ok) {
              recordLearningSignal(message.interactionId, { copied: true });
              copy.classList.add("is-copied");
              copy.title = "Kopyalandı";
              copy.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
              setTimeout(() => {
                copy.classList.remove("is-copied");
                copy.title = "Kopyala";
                copy.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
              }, 1800);
            }
          });
          copy.type = "button";
          copy.setAttribute("aria-label", "Cavabı kopyala");
          copy.title = "Kopyala";
          copy.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

          actions.append(copy);

          const positive = button("", `ask-response-action${message.feedback === "positive" ? " is-selected" : ""}`, () => {
            message.feedback = "positive";
            recordLearningSignal(message.interactionId, { explicitRating: "positive", accepted: true });
            render();
          });
          positive.type = "button";
          positive.title = "Faydalı";
          positive.setAttribute("aria-label", "Cavab faydalıdır");
          positive.textContent = "↑";
          const negative = button("", `ask-response-action${message.feedback === "negative" ? " is-selected" : ""}`, () => {
            message.feedback = "negative";
            recordLearningSignal(message.interactionId, { explicitRating: "negative" });
            render();
          });
          negative.type = "button";
          negative.title = "Faydalı deyil";
          negative.setAttribute("aria-label", "Cavab faydalı deyil");
          negative.textContent = "↓";
          actions.append(positive, negative);

          const moreMenu = document.createElement("details");
          moreMenu.className = "ask-response-more-menu";
          const moreTrigger = element("summary", "ask-response-action ask-response-more-btn");
          moreTrigger.setAttribute("aria-label", "Seçimlər");
          moreTrigger.title = "Daha çox";
          moreTrigger.innerHTML = `
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <circle cx="5" cy="12" r="1.8"></circle>
              <circle cx="12" cy="12" r="1.8"></circle>
              <circle cx="19" cy="12" r="1.8"></circle>
            </svg>
          `;

          const morePopover = element("div", "ask-response-more-popover");

          const msgModelInfo = getAskMessageModelInfo(message.model);

          const modelRow = element("div", "ask-response-model-row");
          const modelLabel = element("span", "ask-response-model-label", "Rejim:");
          const modelName = element("span", "ask-response-model-name", msgModelInfo.displayName);
          modelRow.append(modelLabel, modelName);
          morePopover.appendChild(modelRow);

          const divider = element("div", "ask-response-popover-divider");
          morePopover.appendChild(divider);

          if (message.groundingMetadata) {
            const sourcesBtn = button("", "ask-response-popover-item ask-sources-btn", (event) => {
              event.preventDefault();
              event.stopPropagation();
              moreMenu.open = false;
              openGroundingSourcesModal(message.groundingMetadata);
            });
            sourcesBtn.type = "button";
            sourcesBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <span>Mənbələr</span>
            `;
            morePopover.appendChild(sourcesBtn);
          }

          if (!msgModelInfo.isTerra && !msgModelInfo.isGemini) {
            const thinkDeeperBtn = button("", "ask-response-popover-item ask-think-deeper-btn", (event) => {
              event.preventDefault();
              event.stopPropagation();
              moreMenu.open = false;
              thinkDeeperWithTerra(messageIndex);
            });
            thinkDeeperBtn.type = "button";
            thinkDeeperBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"/>
              </svg>
              <span>Daha dərindən düşün</span>
            `;
            morePopover.appendChild(thinkDeeperBtn);
          }

          const reportBtn = button("", "ask-response-popover-item ask-report-issue-btn", (event) => {
            event.preventDefault();
            event.stopPropagation();
            moreMenu.open = false;
            openLegalReportModal({ messageContent: message.content, model: msgModelInfo.displayName });
          });
          reportBtn.type = "button";
          reportBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Hüquqi problem bildir</span>
          `;
          morePopover.appendChild(reportBtn);

          moreMenu.append(moreTrigger, morePopover);

          const closeMoreMenu = (event) => {
            const path = event.composedPath ? event.composedPath() : [];
            if (path.includes(moreMenu) || moreMenu.contains(event.target)) return;
            moreMenu.open = false;
          };
          moreMenu.addEventListener("toggle", () => {
            if (moreMenu.open) {
              setTimeout(() => {
                document.addEventListener("pointerdown", closeMoreMenu);
              }, 0);
            } else {
              document.removeEventListener("pointerdown", closeMoreMenu);
            }
          });

          actions.appendChild(moreMenu);

          content.appendChild(actions);
          if (isFreshResponse) {
            const caret = element("span", "ask-answer-caret");
            content.appendChild(caret);
            setTimeout(() => caret.remove(), 900);
          }
        }
      } else {
        if (message.file) {
          const fileBadge = element("div", "ask-message-attachment");
          const iconWrap = element("span", "ask-message-attachment-icon");
          iconWrap.innerHTML = getFileIconSvg(message.file.mimeType || message.file.type, message.file.name);
          const meta = element("div", "ask-message-attachment-meta");
          meta.append(
            element("span", "ask-message-attachment-name", message.file.name || "Fayl"),
            element("span", "ask-message-attachment-size", formatFileSize(message.file.size))
          );
          fileBadge.append(iconWrap, meta);
          content.appendChild(fileBadge);
        }
        if (message.content) {
          content.appendChild(element("div", "ask-message-text", message.content));
        }
        if (message.strategyTitle) {
          content.appendChild(element("span", "ask-message-context", `Strategiya: ${message.strategyTitle}`));
        }
        if (message.taskTitle) {
          content.appendChild(element("span", "ask-message-context", `Tapşırıq: ${message.taskTitle}`));
        }
      }
      row.appendChild(content);
      thread.appendChild(row);
    });
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
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.id = "askFileInput";
  fileInput.className = "sr-only";
  fileInput.accept = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.gif,.txt,.md,.csv,.json,.docx,.doc,.xlsx,.xls,.html,.js,.ts,.py,.css";

  const handleFileSelection = async (file) => {
    if (!file) return;
    try {
      state.askLoading = true;
      render();
      const fileData = await readUploadedFileAsData(file);
      state.askPendingFile = fileData;
      state.askModel = "gemini-3.7-flash";
      try { localStorage.setItem("marketify_ask_model", "gemini-3.7-flash"); } catch {}
      state.askError = "";
    } catch (err) {
      state.askError = err.message || "Fayl oxunarkən xəta baş verdi.";
    } finally {
      state.askLoading = false;
      render();
    }
  };

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) handleFileSelection(file);
    fileInput.value = "";
  });

  const contextMenu = document.createElement("details");
  contextMenu.className = `ask-context-menu${selectedStrategy || selectedTask ? " has-selection" : ""}`;
  const contextTrigger = element("summary", "ask-context-trigger");
  contextTrigger.setAttribute("aria-label", "Kontekst seç");
  contextTrigger.title = selectedStrategy || selectedTask ? `Kontekst: ${[selectedStrategy?.title, selectedTask?.text].filter(Boolean).join(" · ")}` : "Kontekst seç";
  contextTrigger.appendChild(element("span", "ask-context-plus", "+"));
  const contextPopover = element("div", "ask-context-popover");
  const activeTasks = state.plannerTasks.filter((task) => !task.completed);
  let contextPane = "main";
  let input;
  let resizeInput = () => {};
  const drawContextMenu = () => {
    contextPopover.replaceChildren();
    if (contextPane === "main") {
      contextPopover.appendChild(element("strong", "ask-context-menu-heading", "Kontekst əlavə et"));
      const option = (title, description, pane) => {
        const btn = button("", "ask-context-menu-option", (event) => {
          event.preventDefault(); event.stopPropagation(); contextMenu.open = true;
          contextPane = pane; drawContextMenu();
        });
        const text = element("span", "ask-context-menu-option-copy");
        text.append(element("strong", "", title), element("small", "", description));
        btn.append(text, element("span", "ask-context-menu-chevron", "›"));
        contextPopover.appendChild(btn);
      };

      const fileOption = button("", "ask-context-menu-option ask-context-menu-option-file", (event) => {
        event.preventDefault();
        event.stopPropagation();
        contextMenu.open = false;
        fileInput.click();
      });
      const fileLeading = element("span", "ask-context-menu-option-icon");
      fileLeading.innerHTML = `
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
      `;
      const fileCopy = element("span", "ask-context-menu-option-copy");
      fileCopy.append(element("strong", "", "Fayl əlavə et"), element("small", "", "PDF, şəkil və ya sənəd yüklə"));
      const fileMain = element("div", "ask-context-menu-option-main");
      fileMain.append(fileLeading, fileCopy);
      fileOption.append(fileMain, element("span", "ask-context-menu-chevron", "›"));
      contextPopover.appendChild(fileOption);
      contextPopover.appendChild(element("div", "ask-context-menu-divider"));

      if (selectedStrategy) option("Hazır sual seç", "Strategiyaya uyğun hazır prompt seç", "prompts");
      option("Strategiyalarım", "Yadda saxlanılan strategiyanı müzakirə et", "strategies");
      option("Planlaşdırılanlar", "Aktiv taskı kontekst kimi seç", "tasks");
      if (!selectedStrategy) option("Hazır sual", "Başlamaq üçün hazır prompt seç", "prompts");
      if (selectedStrategy || selectedTask) {
        contextPopover.appendChild(element("div", "ask-context-menu-divider"));
        contextPopover.appendChild(button("Konteksti sil", "ask-context-clear", () => {
          state.askStrategyId = ""; state.askTaskId = ""; state.askPromptHintStrategyId = ""; contextMenu.open = false; render();
        }));
      }
      return;
    }
    if (contextPane === "prompts") {
      addPresetPromptPane(contextPopover, "ask", (prompt) => {
        contextMenu.open = false;
        appendPresetPrompt(input, prompt, resizeInput);
      }, () => { contextPane = "main"; drawContextMenu(); });
      return;
    }
    const isStrategy = contextPane === "strategies";
    const back = button("‹", "ask-context-menu-back", (event) => {
      event.preventDefault(); event.stopPropagation(); contextMenu.open = true;
      contextPane = "main"; drawContextMenu();
    });
    back.setAttribute("aria-label", "Kontekst menyusuna qayıt");
    const subHeader = element("div", "ask-context-menu-subheader");
    subHeader.append(back, element("strong", "ask-context-menu-heading", isStrategy ? "Strategiyalar" : "Planlaşdırılanlar"));
    contextPopover.appendChild(subHeader);
    const list = element("div", "ask-context-list");
    const entries = isStrategy ? state.savedStrategies : activeTasks;
    if (!entries.length) {
      list.appendChild(element("div", "ask-context-empty", isStrategy ? "Arxiv hələ boşdur." : "Aktiv planlaşdırılan task yoxdur."));
    } else entries.forEach((entry) => {
      const selected = isStrategy ? entry.id === state.askStrategyId : entry.id === state.askTaskId;
      const item = button("", `ask-context-item${selected ? " is-selected" : ""}`);
      item.append(element("span", "", isStrategy ? entry.title : entry.text), element("small", "", selected ? "Seçilib" : (isStrategy ? formatDate(entry.updatedAt) : entry.groupLabel || "Ümumi")));
      item.addEventListener("click", () => {
        if (isStrategy) {
          state.askStrategyId = entry.id;
          state.askPromptHintStrategyId = entry.id;
        } else state.askTaskId = entry.id;
        contextMenu.open = false; render();
      });
      list.appendChild(item);
    });
    contextPopover.appendChild(list);
  };
  drawContextMenu();
  const contextSlot = element("div", "ask-context-slot");
  const showPromptHint = selectedStrategy && state.askPromptHintStrategyId === selectedStrategy.id;
  if (showPromptHint) {
    const promptCta = button("Hazır prompt seç", "ask-preset-prompt-cta", () => {
      promptCta.classList.add("is-hidden");
      state.askPromptHintStrategyId = "";
      contextPane = "prompts";
      drawContextMenu();
      contextMenu.open = true;
    });
    promptCta.setAttribute("aria-label", "Hazır sual seç");
    promptCta.insertAdjacentHTML("afterbegin", '<svg class="ask-preset-prompt-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 13V3M4 7l4-4 4 4" /></svg>');
    contextMenu.append(contextTrigger, contextPopover);
    contextSlot.append(contextMenu, promptCta);
    setTimeout(() => {
      promptCta.classList.add("is-hidden");
      state.askPromptHintStrategyId = "";
    }, 3000);
  } else {
    contextMenu.append(contextTrigger, contextPopover);
    contextSlot.appendChild(contextMenu);
  }
  const closeContextMenu = (event) => {
    const path = event.composedPath ? event.composedPath() : [];
    if (path.includes(contextMenu) || contextMenu.contains(event.target)) return;
    contextMenu.open = false;
  };
  contextMenu.addEventListener("toggle", () => {
    if (contextMenu.open) {
      setTimeout(() => {
        document.addEventListener("pointerdown", closeContextMenu);
      }, 0);
    } else {
      document.removeEventListener("pointerdown", closeContextMenu);
      contextPane = "main";
      drawContextMenu();
    }
  });

  const form = element("form", "ask-composer");
  const label = element("label", "sr-only", "Ask sualı");
  label.htmlFor = "askInput";
  input = element("textarea", "ask-input");
  input.id = "askInput";
  input.name = "message";
  input.rows = 1;
  input.maxLength = 8000;
  input.placeholder = selectedStrategy?.title || selectedTask?.text || (state.askPendingFile ? "Fayl haqqında sualını yaz…" : "Marketify-dən soruş…");
  input.disabled = state.askLoading;

  const submit = button("", "ask-submit");
  submit.type = "submit";
  submit.disabled = true;
  submit.setAttribute("aria-label", "Sualı göndər");
  submit.appendChild(element("span", "", "↑"));

  const isFlashSelected = state.askModel === "gemini-3.7-flash";
  const modelSelectorMenu = document.createElement("details");
  modelSelectorMenu.className = "ask-model-selector-menu";
  const modelTrigger = element("summary", "ask-model-selector-trigger");
  modelTrigger.setAttribute("aria-label", "Model rejimi");
  modelTrigger.title = isFlashSelected ? "Rejim: Flash (Fayl və Axtarış)" : "Rejim: Auto";

  modelTrigger.innerHTML = `
    <span class="ask-model-name">${isFlashSelected ? "Flash" : "Auto"}</span>
    <svg class="ask-model-chevron-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
  `;

  const modelPopover = element("div", "ask-model-selector-popover");

  const autoOption = button("", `ask-model-option${!isFlashSelected ? " is-active" : ""}`, (e) => {
    e.preventDefault();
    state.askModel = "auto";
    try { localStorage.setItem("marketify_ask_model", "auto"); } catch {}
    modelSelectorMenu.open = false;
    render();
  });
  autoOption.type = "button";
  autoOption.innerHTML = `
    <div class="ask-model-option-info">
      <strong>Auto</strong>
      <small>Avtomatik rejim</small>
    </div>
    ${!isFlashSelected ? '<span class="ask-model-check">✓</span>' : ''}
  `;

  const flashOption = button("", `ask-model-option${isFlashSelected ? " is-active" : ""}`, (e) => {
    e.preventDefault();
    state.askModel = "gemini-3.7-flash";
    try { localStorage.setItem("marketify_ask_model", "gemini-3.7-flash"); } catch {}
    modelSelectorMenu.open = false;
    render();
  });
  flashOption.type = "button";
  flashOption.innerHTML = `
    <div class="ask-model-option-info">
      <strong>Flash</strong>
      <small>Gündəlik işlər üçün</small>
    </div>
    ${isFlashSelected ? '<span class="ask-model-check">✓</span>' : ''}
  `;

  modelPopover.append(autoOption, flashOption);

  if (isFlashSelected) {
    const divider = element("div", "ask-model-popover-divider");
    const thinkingRow = element("div", "ask-model-toggle-row");
    const thinkingInfo = element("div", "ask-model-toggle-info");
    const thinkingTitle = element("strong", "", "Düşünmə");
    const thinkingSub = element("small", "", state.askThinking ? "Dərin analiz aktivdir" : "Sürətli birbaşa cavab");
    thinkingInfo.append(thinkingTitle, thinkingSub);

    const switchLabel = element("label", "ask-toggle-switch");
    const switchInput = document.createElement("input");
    switchInput.type = "checkbox";
    switchInput.checked = Boolean(state.askThinking);
    switchInput.setAttribute("aria-label", "Düşünmə rejimini dəyiş");
    switchInput.addEventListener("change", (e) => {
      e.stopPropagation();
      state.askThinking = switchInput.checked;
      try { localStorage.setItem("marketify_ask_thinking", String(state.askThinking)); } catch {}
      thinkingSub.textContent = state.askThinking ? "Dərin analiz aktivdir" : "Sürətli birbaşa cavab";
      trackEvent("ask_thinking_toggled", { thinking: state.askThinking });
    });

    const switchSlider = element("span", "ask-toggle-slider");
    switchLabel.append(switchInput, switchSlider);
    thinkingRow.append(thinkingInfo, switchLabel);

    modelPopover.append(divider, thinkingRow);
  }

  modelSelectorMenu.append(modelTrigger, modelPopover);

  const closeModelMenu = (event) => {
    const path = event.composedPath ? event.composedPath() : [];
    if (path.includes(modelSelectorMenu) || modelSelectorMenu.contains(event.target)) return;
    modelSelectorMenu.open = false;
  };
  modelSelectorMenu.addEventListener("toggle", () => {
    if (modelSelectorMenu.open) {
      setTimeout(() => {
        document.addEventListener("pointerdown", closeModelMenu);
      }, 0);
    } else {
      document.removeEventListener("pointerdown", closeModelMenu);
    }
  });

  const composerLeading = element("div", "ask-composer-leading");
  composerLeading.append(contextSlot, fileInput);

  const composerBody = element("div", "ask-composer-body");
  if (state.askPendingFile) {
    const pendingChip = element("div", "ask-pending-file");
    const chipIcon = element("span", `ask-pending-file-icon${state.askPendingFile.type.includes("pdf") ? " is-pdf" : state.askPendingFile.type.startsWith("image/") ? " is-image" : ""}`);
    chipIcon.innerHTML = getFileIconSvg(state.askPendingFile.mimeType || state.askPendingFile.type, state.askPendingFile.name);
    const chipMeta = element("div", "ask-pending-file-meta");
    chipMeta.append(
      element("span", "ask-pending-file-name", state.askPendingFile.name),
      element("span", "ask-pending-file-size", `${formatFileSize(state.askPendingFile.size)} · Flash`)
    );
    const chipRemove = button("", "ask-pending-file-remove", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.askPendingFile = null;
      render();
    });
    chipRemove.type = "button";
    chipRemove.setAttribute("aria-label", "Faylı sil");
    chipRemove.title = "Faylı sil";
    chipRemove.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    pendingChip.append(chipIcon, chipMeta, chipRemove);
    composerBody.appendChild(pendingChip);
  }
  composerBody.append(label, input);

  const composerActions = element("div", "ask-composer-actions");
  composerActions.append(modelSelectorMenu, submit);

  form.append(composerLeading, composerBody, composerActions);

  // Drag & drop file upload on composer
  form.addEventListener("dragover", (e) => {
    e.preventDefault();
    form.classList.add("is-dragover");
  });
  form.addEventListener("dragleave", (e) => {
    if (!form.contains(e.relatedTarget)) {
      form.classList.remove("is-dragover");
    }
  });
  form.addEventListener("drop", (e) => {
    e.preventDefault();
    form.classList.remove("is-dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelection(file);
  });

  // Paste image / file from clipboard
  input.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            handleFileSelection(file);
            break;
          }
        }
      }
    }
  });

  const helper = element("div", "ask-composer-meta");
  const disclaimer = element("p", "ask-disclaimer", "Marketify süni intellekt funksiyası yerinə yetirir və səhvlər edə bilər.");
  helper.appendChild(disclaimer);
  composerArea.append(form, helper);
  shell.append(thread, composerArea);
  workspace.appendChild(shell);

  resizeInput = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    const hasText = input.value.trim().length >= 2;
    const hasFile = Boolean(state.askPendingFile);
    submit.disabled = (!hasText && !hasFile) || state.askLoading;
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
    const hasFile = Boolean(state.askPendingFile);
    if (message.length >= 2 || hasFile) {
      submitAskMessage(message, state.askPendingFile);
    }
  });

  requestAnimationFrame(() => {
    if (state.askMessages.length) composerArea.scrollIntoView({ block: "end" });
    if (!state.askLoading && window.innerWidth > 767) input.focus();
  });
}

class LiveTypewriter {
  constructor(onUpdate, onComplete) {
    this.targetText = "";
    this.currentText = "";
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.rafId = null;
    this.isDone = false;
    this.completionPromise = new Promise((resolve) => { this.resolveCompletion = resolve; });
  }

  append(chunk) {
    if (!chunk) return;
    this.targetText += chunk;
    if (!this.rafId) {
      this.tick();
    }
  }

  finish(finalText) {
    if (typeof finalText === "string" && finalText.length > 0) {
      if (finalText.length >= this.targetText.length || !this.targetText) {
        this.targetText = finalText;
      }
    }
    this.isDone = true;
    if (!this.rafId) {
      this.tick();
    }
  }

  flush() {
    if (this.rafId) {
      clearTimeout(this.rafId);
      this.rafId = null;
    }
    this.isDone = true;
    this.currentText = this.targetText;
    if (this.onUpdate) {
      this.onUpdate(this.currentText, true);
    }
    if (this.onComplete) {
      this.onComplete();
    }
    this.resolveCompletion?.();
  }

  waitForCompletion() {
    return this.completionPromise;
  }

  tick() {
    this.rafId = null;
    const remaining = this.targetText.length - this.currentText.length;

    if (remaining > 0) {
      const isFinishing = this.isDone;
      const charsToType = Math.min(
        remaining,
        isFinishing && remaining > 500 ? 120 :
        remaining > 2000 ? 50 :
        remaining > 800 ? 25 :
        remaining > 260 ? 10 :
        remaining > 90 ? 4 :
        remaining > 24 ? 2 : 1
      );
      this.currentText = this.targetText.slice(0, this.currentText.length + charsToType);
      this.onUpdate(this.currentText, false);
      const typedTail = this.currentText.slice(-charsToType);
      const hasNaturalPause = /[.!?,;:\n]$/.test(typedTail);
      const delay = (isFinishing ? 12 : remaining > 260 ? 20 : remaining > 90 ? 28 : remaining > 24 ? 34 : 42) + (hasNaturalPause && !isFinishing ? 24 : 0);
      this.rafId = setTimeout(() => this.tick(), delay);
    } else if (this.isDone) {
      this.currentText = this.targetText;
      this.onUpdate(this.currentText, true);
      if (this.onComplete) this.onComplete();
      this.resolveCompletion?.();
    }
  }
}

function openGroundingSourcesModal(groundingMetadata) {
  if (!groundingMetadata || typeof groundingMetadata !== "object") return;
  const chunks = Array.isArray(groundingMetadata.groundingChunks) ? groundingMetadata.groundingChunks : [];
  const webChunks = chunks
    .map((c) => c && c.web)
    .filter((w) => w && typeof w.uri === "string" && w.uri.startsWith("http"));

  const searchQueries = Array.isArray(groundingMetadata.webSearchQueries)
    ? groundingMetadata.webSearchQueries.filter((q) => typeof q === "string" && q.trim())
    : [];

  const existing = document.querySelector(".ask-sources-drawer-overlay");
  if (existing) existing.remove();

  const overlay = element("div", "ask-sources-drawer-overlay");
  const drawer = element("div", "ask-sources-drawer");

  const dragHandle = element("div", "ask-sources-drag-handle");
  dragHandle.setAttribute("aria-hidden", "true");

  const header = element("div", "ask-sources-drawer-header");
  const titleGroup = element("div", "ask-sources-drawer-title-group");
  const titleRow = element("div", "ask-sources-drawer-title-row");

  const icon = element("span", "ask-sources-drawer-icon");
  icon.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  `;
  const title = element("h3", "", "İstifadə olunan mənbələr");
  titleRow.append(icon, title);

  const subtitle = element("p", "", "Canlı axtarış vasitəsilə əldə edilən veb mənbələri");
  titleGroup.append(titleRow, subtitle);

  const closeModal = () => {
    document.body.style.overflow = "";
    overlay.remove();
    document.removeEventListener("keydown", handleKeydown);
  };

  const closeBtn = element("button", "ask-sources-drawer-close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Bağla");
  closeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;
  closeBtn.addEventListener("click", closeModal);
  header.append(titleGroup, closeBtn);

  const body = element("div", "ask-sources-drawer-body");

  if (searchQueries.length > 0) {
    const queriesBox = element("div", "ask-sources-queries-box");
    const queriesLabel = element("div", "ask-sources-queries-label", "Axtarış sorğuları:");
    const queriesTags = element("div", "ask-sources-queries-tags");
    searchQueries.forEach((query) => {
      queriesTags.appendChild(element("span", "ask-sources-query-tag", query));
    });
    queriesBox.append(queriesLabel, queriesTags);
    body.appendChild(queriesBox);
  }

  if (webChunks.length > 0) {
    const list = element("div", "ask-sources-cards-list");
    const seen = new Set();
    webChunks.forEach((item, index) => {
      if (seen.has(item.uri)) return;
      seen.add(item.uri);

      let hostname = "";
      try {
        hostname = new URL(item.uri).hostname.replace(/^www\./, "");
      } catch {
        hostname = item.uri;
      }
      const titleText = item.title || hostname;

      const card = document.createElement("a");
      card.className = "ask-source-card";
      card.href = item.uri;
      card.target = "_blank";
      card.rel = "noopener noreferrer";

      const cardIndex = element("span", "ask-source-card-index", `${index + 1}`);
      const cardInfo = element("div", "ask-source-card-info");
      const cardTitle = element("span", "ask-source-card-title", titleText);
      const cardUrl = element("span", "ask-source-card-url", hostname || item.uri);
      cardInfo.append(cardTitle, cardUrl);

      const extIcon = element("span", "ask-source-card-icon");
      extIcon.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      `;

      card.append(cardIndex, cardInfo, extIcon);
      list.appendChild(card);
    });
    body.appendChild(list);
  } else {
    body.appendChild(element("p", "ask-sources-empty", "Bu cavab üçün əlavə veb keçidi tapılmadı."));
  }

  drawer.append(dragHandle, header, body);
  overlay.appendChild(drawer);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  const handleKeydown = (e) => {
    if (e.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", handleKeydown);

  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);
}

function updateActiveAskThinkingStatus(message) {
  const activeBubble = document.querySelector(".ask-message.is-streaming .ask-thinking");
  if (activeBubble) {
    const isSearching = message.status === "searching";
    if (isSearching) {
      activeBubble.classList.add("is-searching");
    } else {
      activeBubble.classList.remove("is-searching");
    }

    const labelEl = activeBubble.querySelector(".ask-thinking-label");
    if (labelEl) {
      labelEl.textContent = message.statusText || (isSearching ? "Veb axtarışı..." : "Cavab hazırlanır");
    }

    const iconEl = activeBubble.querySelector(".ask-thinking-icon");
    if (iconEl) {
      if (isSearching) {
        iconEl.innerHTML = `
          <svg class="ask-searching-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        `;
      } else {
        iconEl.innerHTML = `
          <svg class="ask-thinking-sparkle" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z"/>
          </svg>
        `;
      }
    }
    const strategyAskBody = document.querySelector(".strategy-ask-body");
    if (strategyAskBody) strategyAskBody.scrollTop = strategyAskBody.scrollHeight;
  }
}

function updateActiveAskMessageContent(message, showCaret = true) {
  const activeBubble = document.querySelector(".ask-message.is-streaming .ask-message-content");
  if (activeBubble) {
    activeBubble.innerHTML = "";
    if (message.content) {
      activeBubble.appendChild(renderAskRichText(message.content));
    }
    if (showCaret) {
      const caret = element("span", "ask-answer-caret is-streaming");
      activeBubble.appendChild(caret);
    }
    const composerArea = document.querySelector(".ask-composer-area");
    if (composerArea) composerArea.scrollIntoView({ behavior: "instant", block: "end" });
    const strategyAskBody = document.querySelector(".strategy-ask-body");
    if (strategyAskBody) strategyAskBody.scrollTop = strategyAskBody.scrollHeight;
  }
}

function rememberSavedAskChat(chat) {
  if (!chat?.id) return;
  state.askChatId = chat.id;
  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  const historyItem = {
    ...chat,
    messageCount: messages.length,
    lastMessage: messages.at(-1)?.content?.slice(0, 100) || "",
  };
  state.savedChats = [historyItem, ...state.savedChats.filter((item) => item.id !== chat.id)];
  renderRecentList();
  loadSavedChats();
}

async function thinkDeeperWithTerra(messageIndex) {
  if (state.askLoading) return;
  const assistantMsg = state.askMessages[messageIndex];
  if (!assistantMsg || assistantMsg.role !== "assistant") return;

  const historyMessages = state.askMessages.slice(0, messageIndex);
  if (!historyMessages.length) return;

  recordLearningSignal(assistantMsg.interactionId, { regenerated: true });

  assistantMsg.content = "";
  assistantMsg.model = "terra";
  assistantMsg.isStreaming = true;
  state.askLoading = true;
  state.askError = "";
  freshAskResponses.add(assistantMsg);
  render();

  let typewriter = null;
  let accumulatedFullText = "";

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify({
        messages: historyMessages,
        model: "terra",
        strategyId: state.askStrategyId || undefined,
        taskId: state.askTaskId || undefined,
        chatId: state.askChatId || undefined,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Terra ilə yenidən generasiya etmək mümkün olmadı.");
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      typewriter = new LiveTypewriter(
        (text, isComplete) => {
          assistantMsg.content = text;
          updateActiveAskMessageContent(assistantMsg, !isComplete);
        },
        () => {
          assistantMsg.isStreaming = false;
          render();
        }
      );

      let rawBuffer = "";
      let eventLines = [];

      const dispatchEvent = (lines) => {
        if (!lines || !lines.length) return;
        const jsonStr = lines.join("\n").trim();
        if (!jsonStr || jsonStr === "[DONE]") return;

        try {
          const data = JSON.parse(jsonStr);
          if (data.error) throw new Error(data.error);

          if (data.status) {
            assistantMsg.status = data.status;
            assistantMsg.statusText = data.statusText || "";
            updateActiveAskThinkingStatus(assistantMsg);
          }

          if (data.model) assistantMsg.model = data.model;

          if (data.chunk) {
            assistantMsg.status = "";
            assistantMsg.statusText = "";
            accumulatedFullText += data.chunk;
            typewriter.append(data.chunk);
          }

          if (data.done) {
            const finalReply = data.reply || accumulatedFullText;
            accumulatedFullText = finalReply;
            if (data.groundingMetadata) {
              assistantMsg.groundingMetadata = data.groundingMetadata;
            }
            typewriter.finish(finalReply);
            assistantMsg.interactionId = data.interactionId || assistantMsg.interactionId;
            rememberSavedAskChat(data.chat);
          }
        } catch (parseErr) {
          if (parseErr.message && !parseErr.message.includes("JSON")) {
            throw parseErr;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        rawBuffer += decoder.decode(value, { stream: true });
        const lines = rawBuffer.split(/\r?\n/);
        rawBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            eventLines.push(line.replace(/^data:\s*/, ""));
          } else if (line.trim() === "" && eventLines.length > 0) {
            dispatchEvent(eventLines);
            eventLines = [];
          }
        }
      }

      if (eventLines.length > 0) {
        dispatchEvent(eventLines);
        eventLines = [];
      }

      if (typewriter) {
        typewriter.finish(accumulatedFullText);
        await typewriter.waitForCompletion();
      }
      if (accumulatedFullText) {
        assistantMsg.content = accumulatedFullText;
      }
    } else {
      const data = await response.json();
      assistantMsg.content = data.reply;
      assistantMsg.model = data.model || "terra";
      assistantMsg.interactionId = data.interactionId || assistantMsg.interactionId;
      assistantMsg.isStreaming = false;
      rememberSavedAskChat(data.chat);
    }
  } catch (error) {
    state.askError = error.message;
  } finally {
    if (accumulatedFullText && (!assistantMsg.content || assistantMsg.content.length < accumulatedFullText.length)) {
      assistantMsg.content = accumulatedFullText;
    }
    assistantMsg.isStreaming = false;
    state.askLoading = false;
    render();
  }
}

async function submitAskMessage(message, attachedFile = null, { preserveWhitespace = false } = {}) {
  const selectedStrategy = state.savedStrategies.find((strategy) => strategy.id === state.askStrategyId) || null;
  const selectedTask = state.plannerTasks.find((task) => task.id === state.askTaskId) || null;
  const fileToAttach = attachedFile || state.askPendingFile || null;
  state.askPendingFile = null;

  const contentText = message ? (preserveWhitespace ? String(message) : String(message).trim()) : (fileToAttach ? `Bu faylı analiz et: ${fileToAttach.name}` : "");

  state.askMessages.push({
    role: "user",
    content: contentText,
    file: fileToAttach ? { ...fileToAttach } : undefined,
    strategyTitle: selectedStrategy?.title || "",
    taskTitle: selectedTask?.text || "",
  });

  const chosenModel = fileToAttach ? "gemini-3.7-flash" : (state.askModel || "auto");
  const initialPlaceholderModel = chosenModel === "gemini-3.7-flash" ? "gemini-3.7-flash" : (chosenModel === "terra" ? "terra" : (chosenModel === "luna" ? "luna" : "auto"));
  const assistantMsg = {
    role: "assistant",
    content: "",
    model: initialPlaceholderModel,
    isStreaming: true,
  };
  state.askMessages.push(assistantMsg);
  state.askLoading = true;
  state.askError = "";
  freshAskResponses.add(assistantMsg);
  trackEvent("ask_message_sent", { messageCount: state.askMessages.length, model: chosenModel, hasFile: Boolean(fileToAttach) });
  render();

  let typewriter = null;
  let accumulatedFullText = "";

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify({
        messages: state.askMessages.slice(0, -1),
        model: chosenModel,
        thinking: chosenModel === "gemini-3.7-flash" ? Boolean(state.askThinking) : undefined,
        strategyId: state.askStrategyId || undefined,
        taskId: state.askTaskId || undefined,
        chatId: state.askChatId || undefined,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 401 && activeHomepageIntent) {
        window.dispatchEvent(new CustomEvent("marketify:auth-required"));
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Cavabı hazırlamaq mümkün olmadı.");
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      typewriter = new LiveTypewriter(
        (text, isComplete) => {
          assistantMsg.content = text;
          updateActiveAskMessageContent(assistantMsg, !isComplete);
        },
        () => {
          assistantMsg.isStreaming = false;
          render();
        }
      );

      let rawBuffer = "";
      let eventLines = [];

      const dispatchEvent = (lines) => {
        if (!lines || !lines.length) return;
        const jsonStr = lines.join("\n").trim();
        if (!jsonStr || jsonStr === "[DONE]") return;

        try {
          const data = JSON.parse(jsonStr);
          if (data.error) throw new Error(data.error);

          if (data.status) {
            assistantMsg.status = data.status;
            assistantMsg.statusText = data.statusText || "";
            updateActiveAskThinkingStatus(assistantMsg);
          }

          if (data.model) assistantMsg.model = data.model;

          if (data.chunk) {
            assistantMsg.status = "";
            assistantMsg.statusText = "";
            accumulatedFullText += data.chunk;
            typewriter.append(data.chunk);
          }

          if (data.done) {
            const finalReply = data.reply || accumulatedFullText;
            accumulatedFullText = finalReply;
            if (data.groundingMetadata) {
              assistantMsg.groundingMetadata = data.groundingMetadata;
            }
            typewriter.finish(finalReply);
            assistantMsg.interactionId = data.interactionId || assistantMsg.interactionId;
            rememberSavedAskChat(data.chat);
          }
        } catch (parseErr) {
          if (parseErr.message && !parseErr.message.includes("JSON")) {
            throw parseErr;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        rawBuffer += decoder.decode(value, { stream: true });
        const lines = rawBuffer.split(/\r?\n/);
        rawBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            eventLines.push(line.replace(/^data:\s*/, ""));
          } else if (line.trim() === "" && eventLines.length > 0) {
            dispatchEvent(eventLines);
            eventLines = [];
          }
        }
      }

      if (eventLines.length > 0) {
        dispatchEvent(eventLines);
        eventLines = [];
      }

      if (typewriter) {
        typewriter.finish(accumulatedFullText);
        await typewriter.waitForCompletion();
      }
      if (accumulatedFullText) {
        assistantMsg.content = accumulatedFullText;
      }
    } else {
      const data = await response.json();
      assistantMsg.content = data.reply;
      assistantMsg.model = data.model || assistantMsg.model;
      assistantMsg.interactionId = data.interactionId || assistantMsg.interactionId;
      if (data.groundingMetadata) {
        assistantMsg.groundingMetadata = data.groundingMetadata;
      }
      assistantMsg.isStreaming = false;
      rememberSavedAskChat(data.chat);
    }
  } catch (error) {
    state.askError = error.message;
    if (!assistantMsg.content && !accumulatedFullText) {
      const idx = state.askMessages.indexOf(assistantMsg);
      if (idx !== -1) state.askMessages.splice(idx, 1);
    }
  } finally {
    if (accumulatedFullText && (!assistantMsg.content || assistantMsg.content.length < accumulatedFullText.length)) {
      assistantMsg.content = accumulatedFullText;
    }
    for (const msg of state.askMessages) {
      if (msg && msg.file && (msg.file.data || msg.file.textContent)) {
        delete msg.file.data;
        delete msg.file.textContent;
      }
    }
    assistantMsg.isStreaming = false;
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

  // Desktop actions live outside the workspace so they remain accessible while
  // the loading view is vertically centered. Mobile uses the card actions below.
  const topActions = element("div", "loading-top-actions loading-desktop-actions");
  topActions.id = "loadingTopActions";

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
      if (window.confirm("Əsas səhifəyə qayıdırsınız. Bu strategiyanın hazırlanmasını arxa planda davam etdirmək istəyirsiniz? Nəticə hazır olduqda Arxiv bölməsində saxlanılacaq.")) {
        minimizeToBackground();
      }
    });
    topActions.appendChild(bgBtn);
  }

  const desktopCancelBtn = element("button", "loading-cancel-button");
  desktopCancelBtn.type = "button";
  desktopCancelBtn.setAttribute("aria-label", "Brif analizini dayandır");
  desktopCancelBtn.title = "Analizi dayandır";
  desktopCancelBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6" fill="currentColor" rx="1"/>
    </svg>
    <span>Dayandır</span>
  `;
  desktopCancelBtn.addEventListener("click", () => {
    if (window.confirm("Brif analizini dayandırmaq istədiyinizdən əminsiniz?")) cancelCurrentAnalysis();
  });

  const desktopHistoryBtn = element("button", "loading-history-button");
  desktopHistoryBtn.type = "button";
  desktopHistoryBtn.setAttribute("aria-label", "Tarixçə");
  desktopHistoryBtn.title = "Söhbət və brif tarixçəsi";
  desktopHistoryBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
    </svg>
    <span>Tarixçə</span>
    ${state.answers && state.answers.length > 0 ? `<span class="loading-history-badge">${state.answers.length}</span>` : ""}
  `;
  desktopHistoryBtn.addEventListener("click", () => showAnalysisHistoryModal(isAssessment));
  topActions.append(desktopCancelBtn, desktopHistoryBtn);

  // Card Actions
  const cardActions = element("div", "loading-card-actions");

  if (!isAssessment) {
    const bgBtn = element("button", "loading-back-btn-mobile");
    bgBtn.type = "button";
    bgBtn.setAttribute("aria-label", "İşi arxa planda davam etdir");
    bgBtn.title = "İşi arxa planda davam etdir";
    bgBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
      <span>İşi arxa planda davam etdir</span>
    `;
    bgBtn.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Əsas səhifəyə qayıdırsınız. Bu strategiyanın hazırlanmasını arxa planda davam etdirmək istəyirsiniz? Nəticə hazır olduqda Arxiv bölməsində saxlanılacaq."
      );
      if (confirmed) {
        minimizeToBackground();
      }
    });
    cardActions.appendChild(bgBtn);
  }

  const secondaryRow = element("div", "loading-card-actions-secondary");

  const cancelBtn = element("button", "loading-cancel-btn-mobile");
  cancelBtn.type = "button";
  cancelBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

  const historyBtn = element("button", "loading-history-btn-mobile");
  historyBtn.type = "button";
  historyBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15 15"/>
    </svg>
    <span>Tarixçə</span>
    ${state.answers && state.answers.length > 0 ? `<span class="loading-history-badge">${state.answers.length}</span>` : ""}
  `;
  historyBtn.addEventListener("click", () => showAnalysisHistoryModal(isAssessment));

  secondaryRow.append(cancelBtn, historyBtn);
  cardActions.appendChild(secondaryRow);

  view.append(statusLine, title, intro, activity, timelineWrap, reassurance, cardActions);
  workspace.appendChild(view);
  document.body.appendChild(topActions);

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

  const existingJob = backgroundJobs.find((j) => j.idempotencyKey === state.clientSaveId);
  const job = existingJob || {
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

  if (!existingJob) {
    backgroundJobs.unshift(job);
  } else {
    job.status = "generating";
    job.error = null;
  }
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
  showToast("Strategiya arxa planda hazırlanır ✦", "default");
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

async function resumeBackgroundJobs() {
  if (!backgroundJobs.length) return;

  // Ensure saved strategies are loaded
  if (!state.savedStrategies || !state.savedStrategies.length) {
    try {
      await loadSavedStrategies();
    } catch {}
  }

  const jobsToProcess = [...backgroundJobs];
  for (const job of jobsToProcess) {
    // Check if the strategy was already saved on server by idempotencyKey or brief
    const alreadySaved = state.savedStrategies.find(
      (s) => (s.clientSaveId && s.clientSaveId === job.idempotencyKey) || (s.brief && s.brief === job.brief)
    );
    if (alreadySaved) {
      removeBackgroundJob(job.id);
      if (state.view === "list") renderStrategyList();
      continue;
    }

    // If ready but not saved to server yet, retry autoSave
    if (job.status === "ready" && job.strategy && !job.savedId) {
      await autoSaveBackgroundJob(job);
      continue;
    }

    if (job.status !== "generating") continue;

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
        removeBackgroundJob(job.id);
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
      await autoSaveBackgroundJob(job);
    } catch (err) {
      if (err.name === "AbortError") continue;

      // If temporary network disconnection, keep in generating status and retry on reconnect
      if (!navigator.onLine) {
        continue;
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
          continue;
        }
      } catch {}

      if (state.clientSaveId === job.idempotencyKey && state.status === "generating") {
        setError(err, startGeneration, state.questions?.length ? "needs_clarification" : "draft");
        continue;
      }

      job.status = "error";
      job.error = err.message || "Xəta baş verdi";
      persistBackgroundJobs();
      if (state.view === "list") renderStrategyList();
    }
  }
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
      assumptions: job.assumptions || job.strategy?.assumptions || [],
      strategy: job.strategy,
      versions: job.versions || [],
      savedId: job.savedId || null,
      clientSaveId: job.idempotencyKey,
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
    render();
    closeSidebar();
  } else if (job.status === "error") {
    showToast(job.error || "Xəta baş verdi", "error");
    removeBackgroundJob(jobId);
    if (state.view === "list") renderStrategyList();
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
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          messages: thread,
          model: state.askModel || "auto",
          strategyId: state.askStrategyId || undefined,
          taskId: state.askTaskId || undefined,
          chatId: state.askChatId || undefined,
          stream: true,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Cavab almaq mümkün olmadı.");
      }

      loadingItem.classList.remove("is-thinking");
      const contentWrap = loadingItem.querySelector(".ask-thread-msg-content");
      let reply = "";
      const renderReply = () => {
        if (!contentWrap) return;
        contentWrap.innerHTML = "";
        contentWrap.appendChild(renderAskRichText(reply));
      };
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let rawBuffer = "";
      let eventLines = [];

      const dispatchThreadEvent = (lines) => {
        if (!lines || !lines.length) return;
        const jsonStr = lines.join("\n").trim();
        if (!jsonStr || jsonStr === "[DONE]") return;

        try {
          const data = JSON.parse(jsonStr);
          if (data.error) throw new Error(data.error);
          if (data.status === "searching") {
            const dots = loadingItem.querySelector(".loading-processing-dots");
            if (dots && !loadingItem.querySelector(".ask-searching-badge")) {
              const badge = element("div", "ask-searching-badge", "Veb axtarışı...");
              loadingItem.querySelector(".ask-thread-msg-content")?.prepend(badge);
            }
          }
          if (data.chunk) {
            loadingItem.querySelector(".ask-searching-badge")?.remove();
            reply += data.chunk;
            renderReply();
          }
          if (data.done) {
            reply = data.reply || reply;
            renderReply();
            if (data.groundingMetadata) {
              const sourcesBtn = button("🌐 Mənbələr", "ask-thread-sources-btn", () => {
                openGroundingSourcesModal(data.groundingMetadata);
              });
              sourcesBtn.type = "button";
              loadingItem.querySelector(".ask-thread-msg-content")?.appendChild(sourcesBtn);
            }
            rememberSavedAskChat(data.chat);
          }
        } catch (parseErr) {
          if (parseErr.message && !parseErr.message.includes("JSON")) {
            throw parseErr;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawBuffer += decoder.decode(value, { stream: true });
        const lines = rawBuffer.split(/\r?\n/);
        rawBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            eventLines.push(line.replace(/^data:\s*/, ""));
          } else if (line.trim() === "" && eventLines.length > 0) {
            dispatchThreadEvent(eventLines);
            eventLines = [];
          }
        }
      }

      if (eventLines.length > 0) {
        dispatchThreadEvent(eventLines);
        eventLines = [];
      }

      if (!reply) throw new Error("AI boş cavab qaytardı.");
      renderReply();
      thread.push({ role: "assistant", content: reply });
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
  state.buildStreamingText = "";
  state.buildStreamingFinishReason = null;
  setStatus("generating");
  render();

  try {
    let finalStrategy = null;
    try {
      const response = await fetch("/api/strategy/generate-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          brief: state.brief,
          answers: state.answers,
          assumptions: state.assumptions,
          idempotencyKey: state.clientSaveId,
        }),
        signal: currentAbortController.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const err = new Error(errData.error || "Strategiyanı hazırlamaq mümkün olmadı.");
        err.code = errData.code;
        err.status = response.status;
        err.model = errData.model;
        throw err;
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let rawBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          rawBuffer += decoder.decode(value, { stream: true });
          const lines = rawBuffer.split(/\r?\n/);
          rawBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;

            const jsonStr = trimmed.replace(/^data:\s*/, "").trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const evt = JSON.parse(jsonStr);
              if (evt.error) {
                const streamErr = new Error(evt.error);
                streamErr.code = evt.code;
                streamErr.status = evt.status;
                streamErr.model = evt.model;
                throw streamErr;
              }

              if (evt.chunk) {
                state.buildStreamingText = (state.buildStreamingText || "") + evt.chunk;
              }

              if (evt.finishReason) {
                state.buildStreamingFinishReason = evt.finishReason;
              }

              if (evt.done && evt.strategy) {
                finalStrategy = evt.strategy;
              }
            } catch (pErr) {
              if (pErr.code || (pErr.message && !pErr.message.includes("JSON"))) throw pErr;
            }
          }
        }
      } else {
        const data = await response.json();
        finalStrategy = data.strategy;
      }
    } catch (streamFetchErr) {
      if (streamFetchErr.name === "AbortError" || currentAbortController?.signal?.aborted) throw streamFetchErr;
      if (streamFetchErr.code && streamFetchErr.code !== "AI_PROVIDER_ERROR") throw streamFetchErr;

      // Direct fallback to non-streaming generate endpoint
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
      finalStrategy = data.strategy;
    }

    if (!finalStrategy) {
      throw new Error("Strategiya generasiyası tamamlanmadı.");
    }

    currentAbortController = null;

    // Check if this generation was moved to background while awaiting
    const bgJob = backgroundJobs.find((j) => j.idempotencyKey === generationKey);
    if (bgJob) {
      bgJob.status = "ready";
      bgJob.strategy = finalStrategy;
      bgJob.completedAt = new Date().toISOString();
      bgJob.versions = [{ versionNumber: 1, data: finalStrategy, changeRequest: "İlkin strategiya", createdAt: bgJob.completedAt }];
      persistBackgroundJobs();
      autoSaveBackgroundJob(bgJob);
      return;
    }

    state.strategy = finalStrategy;
    state.updatedAt = new Date().toISOString();
    state.versions = [
      {
        versionNumber: 1,
        data: finalStrategy,
        changeRequest: "İlkin strategiya",
        createdAt: state.updatedAt,
      },
    ];
    trackEvent("strategy_generated", { clarificationRounds: state.round, model: "gpt-5.6-terra" });
    setStatus("ready");
    render();
  } catch (error) {
    if (error.name === "AbortError" || currentAbortController?.signal?.aborted) {
      return;
    }
    // Check if this generation was moved to background
    const bgJob = backgroundJobs.find((j) => j.idempotencyKey === generationKey && j.status === "generating");
    if (bgJob) {
      if (!navigator.onLine) {
        // Keep in generating status so online event can resume
        return;
      }
      bgJob.status = "error";
      bgJob.error = error.message || "Xəta baş verdi";
      persistBackgroundJobs();
      if (state.view === "list") renderStrategyList();
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
  const readingTime = element("span", "reading-time-badge", `~${calcReadingTime(strategy)} dəqiqəlik oxu`);
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

  // Fully readable strategy context. Values intentionally wrap instead of
  // relying on truncation or tooltips.
  const contextChips = element("dl", "context-chips-strip strategy-context-grid");
  const appendContextItem = (label, value) => {
    if (!value) return;
    const item = element("div", "context-chip strategy-context-item");
    item.append(element("dt", "strategy-context-label", label), element("dd", "strategy-context-value", String(value)));
    contextChips.appendChild(item);
  };
  appendContextItem("Auditoriya", strategy.context?.targetAudience);
  appendContextItem("Bazar", strategy.context?.market);
  const budget = budgetSignal(state.brief);
  appendContextItem("Büdcə", budget);
  appendContextItem("Biznes", strategy.context?.business);

  // Strateji Xülasə / Executive Brief Box (Clean, single presentation, no duplicate essence text below!)
  const execCard = element("div", "strategy-executive-card");
  const execKicker = element("div", "exec-card-header");
  execKicker.append(
    element("span", "exec-badge", "STRATEJİ XÜLASƏ VƏ ƏSAS İSTİQAMƏT"),
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
  const kicker = element("span", "kpi-card-kicker", "KPI METRİKİ");
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

function resetAskForStrategy(strategyId, force = false) {
  if (!force && state.askStrategyId === strategyId && !state.askTaskId) return;
  state.askChatId = null;
  state.askMessages = [];
  state.askError = "";
  state.askTaskId = "";
  state.askStrategyId = strategyId || "";
}

async function ensureStrategyAskContext() {
  // Strategy chat always delegates model choice to the shared Ask router.
  state.askModel = "auto";
  if (state.savedId) {
    resetAskForStrategy(state.savedId);
    return true;
  }
  if (!state.strategy) return false;

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
    state.status = "saved";
    resetAskForStrategy(state.savedId);
    trackEvent("strategy_saved", { versionCount: state.versions.length, source: "strategy_ask" });
    await loadSavedStrategies();
    return true;
  } catch (error) {
    state.askError = error.message || "Strategiyanı söhbət kontekstinə əlavə etmək mümkün olmadı.";
    render();
    return false;
  }
}

function buildStrategyAskMessage(message, messageIndex) {
  const isAssistant = message.role === "assistant";
  const isStreaming = Boolean(message.isStreaming);
  const row = element("article", `strategy-ask-message ask-message ask-message-${message.role}${isStreaming ? " is-streaming" : ""}`);
  const content = element("div", "ask-message-content");

  if (!isAssistant) {
    if (message.file) {
      const fileBadge = element("div", "ask-message-attachment");
      const iconWrap = element("span", "ask-message-attachment-icon");
      iconWrap.innerHTML = getFileIconSvg(message.file.mimeType || message.file.type, message.file.name);
      const meta = element("div", "ask-message-attachment-meta");
      meta.append(
        element("span", "ask-message-attachment-name", message.file.name || "Fayl"),
        element("span", "ask-message-attachment-size", formatFileSize(message.file.size))
      );
      fileBadge.append(iconWrap, meta);
      content.appendChild(fileBadge);
    }
    if (message.content) {
      content.appendChild(element("div", "ask-message-text", message.content));
    }
    row.appendChild(content);
    return row;
  }

  if (isStreaming && !message.content) {
    const isSearching = message.status === "searching";
    const thinking = element("div", `ask-thinking strategy-ask-thinking${isSearching ? " is-searching" : ""}`);
    const sparkle = isSearching
      ? element("span", "ask-thinking-icon", `
          <svg class="ask-searching-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        `)
      : element("span", "strategy-ask-thinking-spark", "✦");
    const modelInfo = getAskMessageModelInfo(message.model);
    let labelText = modelInfo.isTerra ? "Dərin analiz" : "Cavab hazırlanır";
    if (isSearching || message.statusText) {
      labelText = message.statusText || "Veb axtarışı...";
    }
    const label = element("span", "ask-thinking-label", labelText);
    const dots = element("span", "ask-thinking-dots");
    dots.append(element("i"), element("i"), element("i"));
    thinking.append(sparkle, label, dots);
    content.appendChild(thinking);
  } else {
    content.appendChild(renderAskRichText(message.content));
    if (isStreaming) content.appendChild(element("span", "ask-answer-caret is-streaming"));
  }

  if (!isStreaming && message.content) {
    const actions = element("div", "strategy-ask-message-actions");
    const copy = button("", "strategy-ask-action", async () => {
      const copied = await copyAskResponse(message.content);
      if (!copied) return;
      copy.classList.add("is-copied");
      copy.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => copy.classList.remove("is-copied"), 1400);
    });
    copy.type = "button";
    copy.title = "Kopyala";
    copy.setAttribute("aria-label", "Cavabı kopyala");
    copy.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    actions.appendChild(copy);

    if (message.groundingMetadata) {
      const sourcesBtn = button("🌐 Mənbələr", "strategy-ask-action strategy-ask-sources", () => {
        openGroundingSourcesModal(message.groundingMetadata);
      });
      sourcesBtn.type = "button";
      sourcesBtn.title = "Veb mənbələri";
      actions.appendChild(sourcesBtn);
    }

    if (!getAskMessageModelInfo(message.model).isTerra) {
      const deeper = button("✦ Dərin düşün", "strategy-ask-action strategy-ask-deeper", () => thinkDeeperWithTerra(messageIndex));
      deeper.type = "button";
      deeper.disabled = state.askLoading;
      actions.appendChild(deeper);
    }
    const report = button("", "strategy-ask-action strategy-ask-report", () => {
      openLegalReportModal({ messageContent: message.content, model: getAskMessageModelInfo(message.model).displayName });
    });
    report.type = "button";
    report.title = "Hüquqi problem bildir";
    report.setAttribute("aria-label", "Hüquqi problem bildir");
    report.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5h.01"/></svg>';
    actions.appendChild(report);
    content.appendChild(actions);
  }

  row.appendChild(content);
  return row;
}

function buildStrategyAskAssistant() {
  const root = element(
    "div",
    `strategy-ask-root${state.strategyAskOpen ? " is-open" : ""}${state.refinementOpen ? " is-refinement-open" : ""}`,
  );

  const backdrop = button("", "strategy-ask-backdrop", (e) => {
    e.preventDefault();
    state.strategyAskOpen = false;
    root.classList.remove("is-open");
    document.querySelector(".strategy-view")?.classList.remove("is-ask-open");
    const askBtn = document.querySelector(".dock-ask-btn");
    if (askBtn) askBtn.setAttribute("aria-expanded", "false");
  });
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Strategiya söhbətini bağla");
  root.appendChild(backdrop);

  const panel = element("section", "strategy-ask-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Strategiya üzrə Marketify Ask");

  const header = element("header", "strategy-ask-header");
  const heading = element("div", "strategy-ask-heading");
  const title = element("strong", "", "Ask Marketify");
  const context = element("span", "strategy-ask-context", state.strategy?.title || "Aktiv strategiya");
  heading.append(title, context);
  const close = button("", "strategy-ask-close", (e) => {
    e.preventDefault();
    state.strategyAskOpen = false;
    root.classList.remove("is-open");
    document.querySelector(".strategy-view")?.classList.remove("is-ask-open");
    const askBtn = document.querySelector(".dock-ask-btn");
    if (askBtn) askBtn.setAttribute("aria-expanded", "false");
  });
  close.type = "button";
  close.setAttribute("aria-label", "Söhbəti kiçilt");
  close.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 10 5 5 5-5"/></svg>';
  header.append(heading, close);

  const body = element("div", "strategy-ask-body");
  body.setAttribute("aria-live", "polite");
  if (!state.askMessages.length) {
    const welcome = element("div", "strategy-ask-welcome");
    welcome.innerHTML = `<span class="strategy-ask-orb">✦</span><strong>Strategiyanı birlikdə təhlil edək</strong><p>Bu strategiyanın qərarları, prioritetləri, riskləri və icra addımları barədə soruş.</p>`;
    body.appendChild(welcome);
    [
      "Bu strategiyada ən böyük risk nədir?",
      "İlk 30 gündə nəyə fokuslanmalıyam?",
      "Bu planın zəif nöqtələrini göstər.",
    ].forEach((question) => {
      const suggestion = button(question, "strategy-ask-suggestion", async (e) => {
        e.preventDefault();
        if (state.askLoading) return;
        const ready = await ensureStrategyAskContext();
        if (ready) submitAskMessage(question);
      });
      suggestion.type = "button";
      body.appendChild(suggestion);
    });
  } else {
    state.askMessages.forEach((message, index) => body.appendChild(buildStrategyAskMessage(message, index)));
  }

  if (state.askError) {
    const error = element("div", "strategy-ask-error", state.askError);
    body.appendChild(error);
  }

  const footer = element("footer", "strategy-ask-footer");
  const form = element("form", "strategy-ask-composer");
  const input = element("textarea", "strategy-ask-input");
  input.rows = 1;
  input.maxLength = 8000;
  input.placeholder = "Strategiya haqqında soruş…";
  input.disabled = state.askLoading;
  const send = button("", "strategy-ask-send");
  send.type = "submit";
  send.disabled = true;
  send.setAttribute("aria-label", "Sualı göndər");
  send.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
  form.append(input, send);

  const resize = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
    send.disabled = input.value.trim().length < 2 || state.askLoading;
  };
  input.addEventListener("input", resize);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!send.disabled) form.requestSubmit();
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (message.length < 2 || state.askLoading) return;
    input.value = "";
    send.disabled = true;
    const ready = await ensureStrategyAskContext();
    if (ready) submitAskMessage(message);
  });

  footer.append(form, element("p", "strategy-ask-disclaimer", "Söhbət Ask tarixçəsində saxlanılır · Cavab aktiv strategiya əsasında hazırlanır."));
  panel.append(header, body, footer);
  root.appendChild(panel);

  if (state.strategyAskOpen) {
    requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
      if (!state.askLoading && window.innerWidth > 767) input.focus();
    });
  }
  return root;
}

function renderStrategyWorkspace() {
  workspace.classList.add("workspace-document");
  const strategy = state.strategy;
  const view = element("div", `strategy-view${state.status === "refining" ? " is-refining" : ""}${state.strategyAskOpen ? " is-ask-open" : ""}`);

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
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#${id}`);
      }
    });
    toc.appendChild(link);
  });

  const shell = element("div", "strategy-local-shell");
  shell.append(toc, documentCanvas);
  view.append(toolbar, shell, buildRefinementPanel(), buildStrategyAskAssistant());

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
  const panel = element("section", `refinement-dock${state.refinementOpen ? " is-expanded" : ""}`);
  panel.setAttribute("aria-label", "Strategiyanı idarə et və yenilə");

  // Compact document actions live in the same surface as the refinement composer.
  const actionsStrip = element("div", "dock-actions-strip");

  const refineToggle = button("", "dock-action-btn dock-refine-toggle", (e) => {
    e.preventDefault();
    state.refinementOpen = !state.refinementOpen;
    refineToggle.setAttribute("aria-expanded", String(state.refinementOpen));
    refineToggle.title = state.refinementOpen ? "Bağla" : "Düzəliş istə";
    panel.classList.toggle("is-expanded", state.refinementOpen);

    let popover = panel.querySelector(".refinement-popover");
    if (state.refinementOpen) {
      if (!popover) {
        popover = element("div", "refinement-popover");
        popover.append(form);
        panel.appendChild(popover);
      }
      popover.hidden = false;
      requestAnimationFrame(() => {
        if (!input.disabled) {
          input.focus();
          startRefinementPlaceholderTyping(input);
        }
      });
    } else {
      if (popover) popover.remove();
      clearTimeout(refinementPlaceholderTimer);
    }
  });
  refineToggle.type = "button";
  refineToggle.setAttribute("aria-label", state.refinementOpen ? "Düzəliş pəncərəsini bağla" : "Strategiyada düzəliş istə");
  refineToggle.setAttribute("aria-expanded", String(state.refinementOpen));
  refineToggle.title = state.refinementOpen ? "Bağla" : "Düzəliş istə";
  refineToggle.innerHTML = `
    <svg class="dock-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </svg>
    <span>Düzəliş istə</span>
  `;

  // Export wrap + button with minimalist download/export icon + menu
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
    <span>Yüklə</span>
    <svg class="dock-chevron-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
  `;
  const menu = buildExportMenu(exportBtn);
  const onExportDocClick = (e) => {
    if (!exportWrap.contains(e.target)) {
      menu.classList.remove("is-open");
      exportBtn.setAttribute("aria-expanded", "false");
    }
  };
  exportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle("is-open");
    exportBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      setTimeout(() => document.addEventListener("click", onExportDocClick, { once: true }), 0);
    }
  });
  exportWrap.append(exportBtn, menu);

  const toolbarSeparator = element("span", "dock-toolbar-separator");
  toolbarSeparator.setAttribute("aria-hidden", "true");

  // 3. Save button with minimalist bookmark/check icon
  const saveBtn = button("", `dock-action-btn dock-save-btn${state.savedId ? " is-saved" : ""}`, saveStrategy);
  saveBtn.disabled = Boolean(state.savedId) || state.status === "refining";
  const saveIconSvg = state.savedId
    ? `<svg class="dock-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="8 12 10.7 14.7 16.5 9"/></svg>`
    : `<svg class="dock-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
  saveBtn.innerHTML = `
    ${saveIconSvg}
    <span>${state.savedId ? "Yadda saxlanıldı" : "Yadda saxla"}</span>
  `;

  const askSeparator = element("span", "dock-toolbar-separator dock-ask-separator");
  askSeparator.setAttribute("aria-hidden", "true");

  const askBtn = button("", "dock-action-btn dock-ask-btn", (e) => {
    e.preventDefault();
    state.askModel = "auto";
    if (state.savedId) resetAskForStrategy(state.savedId);
    else resetAskForStrategy("", true);
    state.strategyAskOpen = true;
    const root = document.querySelector(".strategy-ask-root");
    const strategyView = document.querySelector(".strategy-view");
    if (root) {
      root.classList.add("is-open");
      strategyView?.classList.add("is-ask-open");
      askBtn.setAttribute("aria-expanded", "true");
      const askInput = root.querySelector(".strategy-ask-input");
      const askBody = root.querySelector(".strategy-ask-body");
      if (askBody) askBody.scrollTop = askBody.scrollHeight;
      if (askInput && window.innerWidth > 767) askInput.focus();
    } else {
      render();
    }
  });
  askBtn.type = "button";
  askBtn.setAttribute("aria-label", "Bu strategiya haqqında Marketify-dan soruş");
  askBtn.setAttribute("aria-expanded", String(state.strategyAskOpen));
  askBtn.innerHTML = `
    <svg class="dock-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg>
    <span>Strategiya barədə soruş</span>
  `;

  actionsStrip.append(refineToggle, exportWrap, toolbarSeparator, saveBtn, askSeparator, askBtn);

  // Suggestions are presented as an animated placeholder instead of controls.
  const form = element("form", "refinement-form");
  const label = element("label", "sr-only", "Dəyişiklik istəyi");
  label.htmlFor = "refinementInput";

  const inputPrefix = element("div", "refine-input-prefix");
  inputPrefix.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`;

  const input = element("textarea", "refinement-input");
  input.id = "refinementInput";
  input.rows = 1;
  input.maxLength = 2000;
  input.placeholder = "Qısalt";
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

  panel.append(actionsStrip);
  if (state.refinementOpen) {
    const popover = element("div", "refinement-popover");
    popover.append(form);
    panel.appendChild(popover);
    requestAnimationFrame(() => {
      if (!input.disabled) {
        input.focus();
        startRefinementPlaceholderTyping(input);
      }
    });
  }
  return panel;
}

function startRefinementPlaceholderTyping(input) {
  const suggestions = ["Qısalt", "Lokallaşdır", "Daha dərindən düşün", "Praktik et"];
  let suggestionIndex = 0;
  let characterIndex = 0;
  let deleting = false;

  const tick = () => {
    if (!input.isConnected) return;
    const suggestion = suggestions[suggestionIndex];
    input.placeholder = suggestion.slice(0, characterIndex);

    if (!deleting && characterIndex < suggestion.length) {
      characterIndex += 1;
      refinementPlaceholderTimer = setTimeout(tick, 58);
    } else if (!deleting) {
      deleting = true;
      refinementPlaceholderTimer = setTimeout(tick, 2200);
    } else if (characterIndex > 0) {
      characterIndex -= 1;
      refinementPlaceholderTimer = setTimeout(tick, 32);
    } else {
      deleting = false;
      suggestionIndex = (suggestionIndex + 1) % suggestions.length;
      refinementPlaceholderTimer = setTimeout(tick, 220);
    }
  };

  tick();
}

async function requestRefinement(action, request) {
  const previousStatus = state.savedId ? "saved" : "ready";
  clearError();
  state.changeSummary = "";
  state.refinementOpen = false;
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
        acceptForLearning: true,
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

  const excel = button("Excel cədvəli (.xls)", "export-option", () => {
    trackEvent("export_requested", { format: "excel" });
    downloadExport(createExcelExport(state.strategy));
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  });

  menu.append(pdf, doc, excel, csv);
  return menu;
}

function downloadExport(file) {
  const content = file.extension === "xls" && !String(file.content).startsWith("\ufeff")
    ? `\ufeff${file.content}`
    : file.content;
  const url = URL.createObjectURL(new Blob([content], { type: file.type }));
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
    if (state.view === "list") renderStrategyList();
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
    state.askTaskId = data.chat.taskId || "";
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
    const jobTitle = job.brief ? (job.brief.length > 26 ? job.brief.slice(0, 26) + "…" : job.brief) : "Yeni Strategiya";
    textWrap.append(element("span", "recent-title", jobTitle), element("span", "recent-date", "Hazırlanır · " + formatDate(job.startedAt)));
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
      button("Hesab yarat", "primary-button", () => { window.location.href = "/signup?returnTo=/workspace"; }),
      button("Daxil ol", "secondary-button", () => { window.location.href = "/login?returnTo=/workspace"; }),
    );
    panel.appendChild(actions);
    view.append(header, panel);
    workspace.appendChild(view);
    return;
  }
  const tabs = element("div", "settings-tabs");
  tabs.setAttribute("role", "tablist");
  const accountTab = button("Hesab", `settings-tab${state.settingsTab === "account" ? " is-active" : ""}`, () => {
    state.settingsTab = "account";
    renderSettings();
  });
  accountTab.setAttribute("role", "tab");
  accountTab.setAttribute("aria-selected", String(state.settingsTab === "account"));
  const securityTab = button("Təhlükəsizlik", `settings-tab${state.settingsTab === "security" ? " is-active" : ""}`, () => {
    state.settingsTab = "security";
    renderSettings();
  });
  securityTab.setAttribute("role", "tab");
  securityTab.setAttribute("aria-selected", String(state.settingsTab === "security"));
  const experienceTab = button("Fərdiləşdirmə", `settings-tab${state.settingsTab === "experience" ? " is-active" : ""}`, () => {
    state.settingsTab = "experience";
    renderSettings();
  });
  experienceTab.setAttribute("role", "tab");
  experienceTab.setAttribute("aria-selected", String(state.settingsTab === "experience"));
  const legalTab = button("Hüquqi & Məxfilik", `settings-tab${state.settingsTab === "legal" ? " is-active" : ""}`, () => {
    state.settingsTab = "legal";
    renderSettings();
  });
  legalTab.setAttribute("role", "tab");
  legalTab.setAttribute("aria-selected", String(state.settingsTab === "legal"));
  tabs.append(accountTab, experienceTab, securityTab, legalTab);
  view.append(header, tabs);

  if (state.settingsTab === "account") {
    const panel = element("section", "settings-panel");
    panel.append(element("h2", "", "Hesab məlumatları"), element("p", "settings-panel-intro", "Workspace-də görünən adını və giriş məlumatlarını yenilə."));
    const form = element("form", "settings-form account-settings-form");
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

    // Import Memory Banner / Action Card
    const importCard = element("div", "experience-import-banner");
    const importLeft = element("div", "experience-import-left");
    importLeft.innerHTML = `
      <div class="experience-import-icon-badge">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
      <div class="experience-import-text">
        <strong>Yaddaş köçür</strong>
        <p>ChatGPT, Claude və ya Gemini-dakı yaddaşınızı və brend məlumatlarınızı Marketify-a birbaşa köçürün.</p>
      </div>
    `;
    const importBtn = button("Yaddaşı köçür", "secondary-button experience-import-trigger-btn", () => {
      openImportMemoryModal({
        userSettings: state.currentUser?.settings || {},
        onImportSuccess: (updatedUser) => {
          updateWorkspaceIdentity(updatedUser);
          renderSettings();
        },
      });
    });
    importBtn.type = "button";
    importCard.append(importLeft, importBtn);
    panel.appendChild(importCard);

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
      if (isMasterEnabled) {
        isMasterEnabled = false;
        syncMasterToggle();
        return;
      }

      openPersonalizationConsentModal(() => {
        isMasterEnabled = true;
        syncMasterToggle();
      });
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
      title: "Xüsusi təlimatlar",
      desc: "Marketify-ın sizin üçün cavab hazırlayarkən riayət etməli olduğu xüsusi qaydalar.",
      isOpen: false,
      contentNode: customLabel,
    });
    form.appendChild(customAccordion);

    // 4. Memory Hub (Secondary - Collapsible)
    const memoryWrapper = element("div", "experience-memory-wrapper");
    const memoryListContainer = element("div", "experience-memory-list");
    const memoryBadge = element("span", "experience-summary-badge", `${memoriesList.length} qeyd`);
    const categoryNames = {
      business: "Biznes faktı",
      audience: "Auditoriya",
      preference: "Üstünlük",
      constraint: "Məhdudiyyət",
      general: "Qeyd",
    };
    const memoryFilters = [
      { id: "all", label: "Hamısı" },
      { id: "preference", label: "Üstünlüklər" },
      { id: "constraint", label: "Məhdudiyyətlər" },
      { id: "business", label: "Biznes faktları" },
    ];
    let activeMemoryFilter = "all";

    const memoryFilterBar = element("div", "experience-memory-filters");
    memoryFilterBar.setAttribute("role", "tablist");
    memoryFilterBar.setAttribute("aria-label", "Yaddaş kateqoriyası");

    const updateMemoryFilterState = () => {
      const counts = memoriesList.reduce((result, memory) => {
        result[memory.category || "general"] = (result[memory.category || "general"] || 0) + 1;
        return result;
      }, {});
      memoryFilterBar.querySelectorAll(".memory-filter-btn").forEach((filterButton) => {
        const filter = filterButton.dataset.filter;
        const count = filter === "all" ? memoriesList.length : (counts[filter] || 0);
        const countNode = filterButton.querySelector(".memory-filter-count");
        if (countNode) countNode.textContent = count;
        const selected = activeMemoryFilter === filter;
        filterButton.classList.toggle("is-active", selected);
        filterButton.setAttribute("aria-selected", String(selected));
      });
    };

    memoryFilters.forEach(({ id, label }) => {
      const filterButton = button("", "memory-filter-btn", () => {
        activeMemoryFilter = id;
        updateMemoryFilterState();
        renderMemories();
      });
      filterButton.dataset.filter = id;
      filterButton.setAttribute("role", "tab");
      filterButton.setAttribute("aria-selected", String(id === "all"));
      filterButton.append(element("span", "memory-filter-label", label), element("span", "memory-filter-count", "0"));
      memoryFilterBar.appendChild(filterButton);
    });

    const renderMemories = () => {
      memoryListContainer.replaceChildren();
      memoryBadge.textContent = `${memoriesList.length} qeyd`;
      updateMemoryFilterState();
      const visibleMemories = activeMemoryFilter === "all"
        ? memoriesList
        : memoriesList.filter((memory) => memory.category === activeMemoryFilter);
      if (!visibleMemories.length) {
        const emptyText = memoriesList.length
          ? "Bu kateqoriyada yaddaş qeydi yoxdur."
          : "Hələ heç bir yaddaş qeydi saxlanılmayıb.";
        const empty = element("p", "experience-memory-empty", emptyText);
        memoryListContainer.appendChild(empty);
        return;
      }
      visibleMemories.forEach((mem) => {
        const item = element("div", "experience-memory-item");
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
        delBtn.setAttribute("aria-label", "Yaddaş qeydini sil");
        delBtn.title = "Yaddaş qeydini sil";
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="m6 7 1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>';
        item.appendChild(delBtn);
        memoryListContainer.appendChild(item);
      });
    };
    renderMemories();

    const memoryComposer = element("div", "experience-memory-composer is-collapsed");
    const composerHeading = element("div", "experience-memory-composer-heading");
    const composerHeadingCopy = element("div", "experience-memory-composer-heading-copy");
    composerHeadingCopy.append(
      element("span", "experience-memory-composer-title", "Yeni yaddaş qeydi"),
      element("span", "experience-memory-composer-hint", "Model üçün qısa və konkret saxlayın"),
    );
    const setMemoryComposerOpen = (isOpen) => {
      memoryComposer.classList.toggle("is-open", isOpen);
      memoryComposer.classList.toggle("is-collapsed", !isOpen);
      memoryFilterBar.classList.toggle("is-collapsed", isOpen);
      memoryListContainer.classList.toggle("is-collapsed", isOpen);
      composerToggle.setAttribute("aria-expanded", String(isOpen));
      composerToggle.title = isOpen ? "Yaddaş qeydini bağla" : "Yeni yaddaş qeydi əlavə et";
    };
    const composerToggle = button("", "memory-composer-toggle", () => setMemoryComposerOpen(false));
    composerToggle.type = "button";
    composerToggle.setAttribute("aria-label", "Yaddaş qeydini bağla");
    composerToggle.setAttribute("aria-expanded", "false");
    composerToggle.title = "Yaddaş qeydini bağla";
    composerToggle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
    composerHeading.append(
      composerHeadingCopy,
      composerToggle,
    );

    const addMemoryRow = element("div", "experience-add-memory-row");
    const memoryInput = element("input", "settings-input");
    memoryInput.type = "text";
    memoryInput.placeholder = "Yeni fakt əlavə et... məs. Biz yalnız B2B şirkətlərlə işləyirik";
    memoryInput.maxLength = 500;
    memoryInput.setAttribute("aria-label", "Yeni yaddaş qeydi");

    const memoryCategorySelect = element("select", "settings-input settings-select");
    memoryCategorySelect.setAttribute("aria-label", "Yaddaş qeydi kateqoriyası");
    [
      { val: "business", label: "Biznes Faktı" },
      { val: "preference", label: "Üstünlük" },
      { val: "constraint", label: "Məhdudiyyət" },
    ].forEach((c) => {
      const opt = element("option", "", c.label);
      opt.value = c.val;
      memoryCategorySelect.appendChild(opt);
    });

    const addMemoryBtn = button("Yaddaşı saxla", "primary-button experience-add-btn", () => {
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
      setMemoryComposerOpen(false);
      renderMemories();
    });
    addMemoryBtn.type = "button";

    addMemoryRow.append(memoryInput, memoryCategorySelect, addMemoryBtn);
    memoryComposer.append(composerHeading, addMemoryRow);

    const memoryActionArea = element("div", "experience-memory-action-area");
    const memoryPrimaryActions = element("div", "experience-memory-primary-actions");
    const addMemoryActionBtn = button("+ Yaddaş əlavə et", "primary-button memory-add-action-btn", () => {
      setMemoryComposerOpen(true);
      window.requestAnimationFrame(() => memoryInput.focus());
    });
    addMemoryActionBtn.type = "button";
    const importMemoryInlineBtn = button("Başqa AI-dan köçür", "secondary-button experience-import-inline-btn", () => {
      openImportMemoryModal({
        userSettings: state.currentUser?.settings || {},
        onImportSuccess: (updatedUser) => {
          updateWorkspaceIdentity(updatedUser);
          renderSettings();
        },
      });
    });
    importMemoryInlineBtn.type = "button";
    memoryPrimaryActions.append(addMemoryActionBtn, importMemoryInlineBtn);

    const clearMemoriesBtn = button("Bütün yaddaşı təmizlə", "danger-text-button", () => {
      if (confirm("Bütün yaddaş qeydlərini silmək istədiyinizdən əminsiniz?")) {
        memoriesList = [];
        renderMemories();
      }
    });
    clearMemoriesBtn.type = "button";
    memoryActionArea.append(memoryPrimaryActions, clearMemoriesBtn);

    memoryWrapper.append(memoryFilterBar, memoryListContainer, memoryComposer, memoryActionArea);

    const memoryAccordion = createExperienceAccordion({
      title: "Memory Hub",
      desc: "Marketify-ın biznesiniz haqqında yadda saxladığı məlumatları idarə edin.",
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
      createScopeRow("Ask", "Cari sualınızla bağlı olduqda keçmiş söhbətlər və strategiyalardan faydalı məlumatlar avtomatik cəlb edilir.", isAutoContext, (v) => { isAutoContext = v; }),
      createScopeRow("Build", "Yeni strategiya yaradarkən və dəqiqləşdirərkən yuxarıdakı brend profili və ton nəzərə alınır.", isStrategyPersonalization, (v) => { isStrategyPersonalization = v; }),
    );

    const scopesAccordion = createExperienceAccordion({
      title: "Tətbiq rejimləri",
      desc: "Fərdiləşdirmənin hansı modullarda işləməsini tənzimləyin.",
      isOpen: false,
      contentNode: scopesWrapper,
    });
    form.appendChild(scopesAccordion);

    // 6. Default Mode (Bottom Accordion before Save)
    const modeGrid = element("div", "experience-tone-grid experience-mode-grid");
    const modeOptions = [
      {
        id: "build",
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
        name: "Build Rejimi",
        desc: "Marketify açıldıqda və ya yeni sessiyada birbaşa strukturlaşdırılmış strategiya hazırlamaq rejimini aktiv edin.",
      },
      {
        id: "ask",
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        name: "Ask Rejimi",
        desc: "Marketify açıldıqda və ya yeni sessiyada birbaşa AI ilə interaktiv söhbət və operativ sual-cavab rejimini aktiv edin.",
      },
    ];

    let currentDefaultMode = userSettings.defaultMode || "build";
    const currentModeObj = modeOptions.find((m) => m.id === currentDefaultMode) || modeOptions[0];
    const modeBadge = element("span", "experience-summary-badge", currentModeObj.name);

    modeOptions.forEach((opt) => {
      const card = element("button", `experience-tone-card experience-mode-card${currentDefaultMode === opt.id ? " is-selected" : ""}`);
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
        currentDefaultMode = opt.id;
        modeBadge.textContent = opt.name;
        modeGrid.querySelectorAll(".experience-mode-card").forEach((c) => c.classList.remove("is-selected"));
        card.classList.add("is-selected");
      });
      modeGrid.appendChild(card);
    });

    const defaultModeAccordion = createExperienceAccordion({
      title: "Default rejim",
      desc: "Platformanı açarkən Ask və ya Build rejiminin standart olaraq seçilməsini təyin edin.",
      badgeNode: modeBadge,
      isOpen: false,
      contentNode: modeGrid,
    });
    form.appendChild(defaultModeAccordion);

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
        defaultMode: currentDefaultMode,
      };
      try {
        const data = await authRequest("/api/auth/settings", {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        updateWorkspaceIdentity(data.user);
        try {
          localStorage.setItem("marketify_default_mode", currentDefaultMode);
        } catch {}
        state.mode = currentDefaultMode;
        syncMode();
        syncNav();
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
    privacyInfo.append(element("strong", "", "Məxfilik siyasəti"), element("p", "", "Məlumatlarınızın necə toplandığı, istifadə edildiyi və qorunduğu."));
    privacyRow.append(privacyInfo, button("Baxış keçir →", "secondary-button", () => openLegalModal("privacy")));

    const reportRow = element("div", "settings-legal-row");
    const reportInfo = element("div");
    reportInfo.append(element("strong", "", "Hüquqi Problem Bildirişi"), element("p", "", "Platforma və ya AI cavabları ilə bağlı hüquqi narahatlıq və ya pozuntu bildir."));
    reportRow.append(reportInfo, button("Problem bildir →", "secondary-button", () => openLegalReportModal()));

    docsList.append(termsRow, privacyRow, reportRow);
    panel.appendChild(docsList);
    view.appendChild(panel);
  }
  workspace.appendChild(view);
}

function formatArchiveDate(value) {
  if (!value) return "İndi";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "İndi";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return "Bu gün";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isYesterday) return "Dünən";

  const months = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
  const day = date.getDate();
  const month = months[date.getMonth()] || "";

  if (date.getFullYear() === now.getFullYear()) {
    return `${day} ${month}`;
  }
  return `${day} ${month} ${date.getFullYear()}`;
}

function closeAllArchiveMenus() {
  document.querySelectorAll(".archive-context-menu, .archive-sort-menu").forEach((m) => {
    m.hidden = true;
  });
  document.querySelectorAll(".archive-more-btn.is-active").forEach((b) => {
    b.classList.remove("is-active");
  });
}

document.addEventListener("click", () => {
  closeAllArchiveMenus();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAllArchiveMenus();
  }
});

function openArchivePromptModal({ title, label, initialValue, confirmText = "Yadda saxla", onConfirm }) {
  document.querySelectorAll(".archive-modal-overlay").forEach((el) => el.remove());
  const overlay = element("div", "archive-modal-overlay");
  const card = element("div", "archive-modal-card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");

  const titleEl = element("h2", "archive-modal-title", title);
  const input = element("input", "archive-modal-input");
  input.type = "text";
  input.value = initialValue || "";
  input.placeholder = label || "Strategiya adı";

  const actions = element("div", "archive-modal-actions");
  const cancelBtn = button("Ləğv et", "archive-modal-cancel", () => overlay.remove());
  const confirmBtn = button(confirmText, "archive-modal-confirm", async () => {
    const val = input.value.trim();
    if (!val) return;
    overlay.remove();
    await onConfirm(val);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmBtn.click();
    } else if (e.key === "Escape") {
      overlay.remove();
    }
  });

  actions.append(cancelBtn, confirmBtn);
  card.append(titleEl, input, actions);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
  setTimeout(() => {
    input.focus();
    input.select();
  }, 40);
}

function openArchiveConfirmModal({ title, message, confirmText = "Təsdiq et", isDestructive = false, onConfirm }) {
  document.querySelectorAll(".archive-modal-overlay").forEach((el) => el.remove());
  const overlay = element("div", "archive-modal-overlay");
  const card = element("div", "archive-modal-card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");

  const titleEl = element("h2", "archive-modal-title", title);
  const descEl = element("p", "archive-modal-desc", message);

  const actions = element("div", "archive-modal-actions");
  const cancelBtn = button("Ləğv et", "archive-modal-cancel", () => overlay.remove());
  const confirmBtn = button(confirmText, `archive-modal-confirm${isDestructive ? " is-destructive" : ""}`, async () => {
    overlay.remove();
    await onConfirm();
  });

  actions.append(cancelBtn, confirmBtn);
  card.append(titleEl, descEl, actions);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

function createStrategyRowContextMenu(record) {
  const menu = element("div", "archive-context-menu");
  menu.hidden = true;

  const openItem = button("", "archive-menu-item", (e) => {
    e.stopPropagation();
    menu.hidden = true;
    openSavedStrategy(record.id);
  });
  openItem.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg><span>Aç</span>`;

  const renameItem = button("", "archive-menu-item", (e) => {
    e.stopPropagation();
    menu.hidden = true;
    openArchivePromptModal({
      title: "Adını dəyiş",
      label: "Strategiya adı",
      initialValue: record.title,
      confirmText: "Yadda saxla",
      onConfirm: async (newTitle) => {
        try {
          await api(`/api/strategy/${record.id}`, {
            method: "PATCH",
            body: JSON.stringify({ title: newTitle }),
          });
          if (state.savedId === record.id && state.strategy) {
            state.strategy.title = newTitle;
          }
          await loadSavedStrategies();
          showToast("Strategiyanın adı dəyişdirildi ✓");
        } catch (error) {
          showToast(error.message || "Adı dəyişmək mümkün olmadı.", "error");
        }
      },
    });
  });
  renameItem.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Adını dəyiş</span>`;

  const duplicateItem = button("", "archive-menu-item", async (e) => {
    e.stopPropagation();
    menu.hidden = true;
    try {
      await api(`/api/strategy/${record.id}/duplicate`, { method: "POST" });
      await loadSavedStrategies();
      showToast("Strategiyanın dublikatı yaradıldı ✓");
    } catch (error) {
      showToast(error.message || "Dublikat yaratmaq mümkün olmadı.", "error");
    }
  });
  duplicateItem.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Dublikat yarat</span>`;

  const saveItem = button("", "archive-menu-item", (e) => {
    e.stopPropagation();
    menu.hidden = true;
    showToast("Strategiya artıq arxivdə saxlanılıb ✓");
  });
  saveItem.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span>Arxivlə / Yadda saxla</span>`;

  const divider = element("div", "archive-menu-divider");

  const deleteItem = button("", "archive-menu-item is-destructive", (e) => {
    e.stopPropagation();
    menu.hidden = true;
    openArchiveConfirmModal({
      title: "Strategiyanı sil",
      message: `"${record.title || "Bu strategiya"}" arxivdən birdəfəlik silinəcək. Bu əməliyyat geri qaytarılmır.`,
      confirmText: "Sil",
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api(`/api/strategy/${record.id}`, { method: "DELETE" });
          if (state.savedId === record.id) {
            resetStrategy();
          }
          await loadSavedStrategies();
          showToast("Strategiya arxivdən silindi.");
        } catch (error) {
          showToast(error.message || "Strategiyanı silmək mümkün olmadı.", "error");
        }
      },
    });
  });
  deleteItem.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>Sil</span>`;

  menu.append(openItem, renameItem, duplicateItem, saveItem, divider, deleteItem);
  return menu;
}

function renderStrategyList() {
  workspace.classList.add("workspace-list");
  workspace.replaceChildren();

  const view = element("section", "strategies-view");
  const heading = element("div", "archive-header");
  const copy = element("div", "archive-header-copy");
  copy.append(
    element("h1", "archive-title", "Arxiv"),
    element("p", "archive-subtitle", "Strategiyalarını və saxladığın işləri idarə et")
  );
  const newBtn = button("", "archive-new-btn", resetStrategy);
  newBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Yeni</span>`;
  heading.append(copy, newBtn);
  view.appendChild(heading);

  const activeBgJobs = backgroundJobs.filter((j) => j.status === "generating" || j.status === "ready" || j.status === "error");

  if (!state.savedStrategies.length && !activeBgJobs.length) {
    const empty = element("div", "archive-empty-state");
    const emptyNewBtn = button("", "archive-new-btn", resetStrategy);
    emptyNewBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Yeni</span>`;
    empty.append(
      element("h2", "archive-empty-title", "Hələ strategiya yoxdur"),
      element("p", "archive-empty-desc", "İlk strategiyanı yaradaraq işə başla."),
      emptyNewBtn,
    );
    view.appendChild(empty);
  } else {
    // 2-level editorial controls layout
    const controlsSection = element("div", "archive-controls-section");

    // Search wrap (compact 320-360px)
    const searchWrap = element("div", "archive-search-wrap");
    searchWrap.innerHTML = `<svg class="archive-search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    const search = element("input", "archive-search-input");
    search.type = "search";
    search.placeholder = "Strategiyalarda axtar";
    search.setAttribute("aria-label", "Strategiyalarda axtar");
    searchWrap.appendChild(search);

    // Toolbar with simple editorial tabs on left and Sort on right
    const toolbar = element("div", "archive-toolbar");

    const tabs = element("div", "archive-tabs");
    let currentFilter = "Hamısı";
    ["Hamısı", "Son", "Yadda saxlanmış"].forEach((label, index) => {
      const tabBtn = button(label, `archive-tab${index === 0 ? " is-active" : ""}`, () => {
        currentFilter = label;
        [...tabs.children].forEach((item) => item.classList.toggle("is-active", item === tabBtn));
        drawRows();
      });
      tabs.appendChild(tabBtn);
    });

    let currentSort = "newest";
    const sortLabels = {
      newest: "Son yenilənən",
      oldest: "Ən köhnə",
      alphabetical: "Əlifba sırası",
    };
    const sortWrap = element("div", "archive-sort-wrap");
    const sortBtn = button("", "archive-sort-btn");
    const sortLabelSpan = element("span", "archive-sort-label", sortLabels[currentSort]);
    const sortChevron = element("span", "archive-sort-chevron");
    sortChevron.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
    sortBtn.append(sortLabelSpan, sortChevron);

    const sortMenu = element("div", "archive-sort-menu");
    sortMenu.hidden = true;
    [
      { key: "newest", label: "Son yenilənən" },
      { key: "oldest", label: "Ən köhnə" },
      { key: "alphabetical", label: "Əlifba sırası" },
    ].forEach((opt) => {
      const optBtn = button(opt.label, `archive-sort-option${opt.key === currentSort ? " is-selected" : ""}`, (e) => {
        e.stopPropagation();
        currentSort = opt.key;
        sortLabelSpan.textContent = opt.label;
        [...sortMenu.children].forEach((c) => c.classList.remove("is-selected"));
        optBtn.classList.add("is-selected");
        sortMenu.hidden = true;
        drawRows();
      });
      sortMenu.appendChild(optBtn);
    });

    sortBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasHidden = sortMenu.hidden;
      closeAllArchiveMenus();
      sortMenu.hidden = !wasHidden;
    });

    sortWrap.append(sortBtn, sortMenu);
    toolbar.append(tabs, sortWrap);
    controlsSection.append(searchWrap, toolbar);
    view.appendChild(controlsSection);

    const list = element("div", "strategy-library");

    const drawRows = () => {
      const query = search.value.trim().toLocaleLowerCase("az");
      list.replaceChildren();

      // Render active background jobs seamlessly
      const matchingBgJobs = activeBgJobs.filter((job) => !query || `${job.brief || ""} ${job.strategy?.summary || ""}`.toLocaleLowerCase("az").includes(query));
      if (currentFilter !== "Yadda saxlanmış") {
        matchingBgJobs.forEach((job) => {
          const isGenerating = job.status === "generating";
          const isError = job.status === "error";
          const row = element("article", `strategy-library-row ${isGenerating ? "library-row-progress" : isError ? "library-row-error" : ""}`);
          row.setAttribute("role", "button");
          row.setAttribute("tabindex", "0");

          const briefTitle = job.brief ? (job.brief.length > 70 ? job.brief.slice(0, 70) + "…" : job.brief) : "Yeni Strategiya";
          const subtitle = isGenerating
            ? "Məlumatlar analiz olunur və strateji plan formalaşdırılır…"
            : isError
            ? (job.error || "Generasiya zamanı xəta baş verdi.")
            : (firstSentences(job.strategy?.summary || job.brief, 1));

          // Top Header (Title + Chevron)
          const rowHeader = element("div", "archive-row-header");
          rowHeader.append(
            element("h2", "archive-row-title", isGenerating ? briefTitle : (job.strategy?.title || briefTitle))
          );
          if (!isError) {
            const chevron = element("span", "archive-chevron-icon");
            chevron.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;
            rowHeader.appendChild(chevron);
          }

          const descEl = element("p", "archive-row-desc", subtitle);

          // Footer (Date · Version + Status + Actions)
          const rowFooter = element("div", "archive-row-footer");
          const metaLine = element("div", "archive-row-meta-line");

          const dateVer = element("span", "archive-row-date-ver", `Başladı ${formatArchiveDate(job.startedAt)} · ${isGenerating ? "Arxa planda" : isError ? "Xəta" : "v1"}`);
          const statusEl = element("div", `archive-row-status ${isGenerating ? "is-generating" : isError ? "is-error" : ""}`);
          const dot = element("span", "archive-status-dot");
          statusEl.append(dot, document.createTextNode(isGenerating ? "Hazırlanır" : isError ? "Xəta" : "Hazırdır"));
          metaLine.append(dateVer, statusEl);

          const actionsWrap = element("div", "archive-row-actions");
          if (isError) {
            const retryBtn = button("Yoxla", "bg-job-retry-btn", (e) => {
              e.stopPropagation();
              job.status = "generating";
              job.error = null;
              persistBackgroundJobs();
              resumeBackgroundJobs();
              render();
            });
            const deleteBtn = button("Sil", "bg-job-delete-btn", (e) => {
              e.stopPropagation();
              removeBackgroundJob(job.id);
              render();
            });
            actionsWrap.append(retryBtn, deleteBtn);
          }

          rowFooter.append(metaLine, actionsWrap);
          row.append(rowHeader, descEl, rowFooter);

          if (!isError) {
            row.addEventListener("click", () => openBackgroundJob(job.id));
            row.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openBackgroundJob(job.id);
              }
            });
          }

          list.appendChild(row);
        });
      }

      let records = state.savedStrategies.filter((record) => !query || `${record.title} ${record.strategy?.summary || record.brief}`.toLocaleLowerCase("az").includes(query));

      if (currentFilter === "Son") {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        records = records.filter((r) => new Date(r.updatedAt || r.createdAt || 0).getTime() >= sevenDaysAgo);
      } else if (currentFilter === "Yadda saxlanmış") {
        records = records.filter((r) => Boolean(r.id));
      }

      // Sort
      records.sort((a, b) => {
        if (currentSort === "oldest") {
          return (a.updatedAt || a.createdAt || "").localeCompare(b.updatedAt || b.createdAt || "");
        }
        if (currentSort === "alphabetical") {
          return (a.title || "").localeCompare(b.title || "", "az");
        }
        return (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "");
      });

      if (!records.length && (!matchingBgJobs.length || currentFilter === "Yadda saxlanmış")) {
        const noRes = element("div", "archive-no-results");
        noRes.append(
          element("h3", "", "Nəticə tapılmadı"),
          element("p", "", query ? `“${search.value.trim()}” üçün uyğun strategiya yoxdur.` : "Bu filter üçün uyğun strategiya yoxdur."),
          button("Filterləri təmizlə", "archive-clear-filters-btn", () => {
            search.value = "";
            currentFilter = "Hamısı";
            [...tabs.children].forEach((item, i) => item.classList.toggle("is-active", i === 0));
            drawRows();
            search.focus();
          })
        );
        list.appendChild(noRes);
        return;
      }

      records.forEach((record) => {
        const row = element("article", "strategy-library-row");
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.setAttribute("aria-label", `${record.title}, ${formatArchiveDate(record.updatedAt)}`);

        row.addEventListener("click", () => openSavedStrategy(record.id));
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openSavedStrategy(record.id);
          }
        });

        // Top Header: Title + Chevron
        const rowHeader = element("div", "archive-row-header");
        const titleEl = element("h2", "archive-row-title", record.title);
        const chevron = element("span", "archive-chevron-icon");
        chevron.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;
        rowHeader.append(titleEl, chevron);

        // Body: Description
        const descEl = element("p", "archive-row-desc", firstSentences(record.strategy?.summary || record.brief, 1));

        // Footer: Date · Version + Status + Context Menu
        const rowFooter = element("div", "archive-row-footer");
        const metaLine = element("div", "archive-row-meta-line");
        metaLine.setAttribute("title", `${formatDate(record.updatedAt)} · Versiya ${record.versionCount || 1}`);

        const dateVer = element("span", "archive-row-date-ver", `${formatArchiveDate(record.updatedAt)} · v${record.versionCount || 1}`);
        const status = element("div", "archive-row-status");
        const dot = element("span", "archive-status-dot");
        status.append(dot, document.createTextNode("Hazırdır"));
        metaLine.append(dateVer, status);

        const actionsWrap = element("div", "archive-row-actions");
        const moreBtn = button("", "archive-more-btn");
        moreBtn.setAttribute("aria-label", "Strategiya əməliyyatları");
        moreBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`;

        const contextMenu = createStrategyRowContextMenu(record);

        moreBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const wasHidden = contextMenu.hidden;
          closeAllArchiveMenus();
          if (wasHidden) {
            contextMenu.hidden = false;
            moreBtn.classList.add("is-active");
          }
        });

        actionsWrap.append(moreBtn, contextMenu);
        rowFooter.append(metaLine, actionsWrap);

        row.append(rowHeader, descEl, rowFooter);
        list.appendChild(row);
      });
    };

    search.addEventListener("input", drawRows);
    drawRows();
    view.appendChild(list);
  }
  workspace.appendChild(view);
}

async function openSavedStrategy(id) {
  try {
    const data = await api(`/api/strategy/${id}`);
    const record = data.strategy;
    state.mode = "build";
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
      strategyAskOpen: false,
      refinementOpen: false,
    });
    syncMode();
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

  // Workspace header
  const headerRow = element("header", "planner-header-row");
  const headerText = element("div", "planner-header-text");
  headerText.append(
    element("span", "section-kicker", "WORKSPACE"),
    element("h1", "", "Planlaşdırılanlar"),
    element("p", "", "Strategiyalardan əlavə etdiyin və şəxsi tapşırıqlarının icra planı.")
  );

  headerRow.append(headerText);
  view.appendChild(headerRow);

  // Persistent task composer — its visual placement is handled in CSS so the
  // existing add-task behaviour and keyboard submission remain unchanged.
  const composer = element("form", "planner-composer-card");
  const taskInput = element("input", "planner-composer-input");
  taskInput.type = "text";
  taskInput.placeholder = "Yeni tapşırıq əlavə et...";
  taskInput.required = true;

  const composerBottom = element("div", "planner-composer-bottom");

  const selectPill = element("div", "planner-time-select-pill");
  const selectLabel = element("span", "planner-select-label", "Bu gün");
  const groupSelect = document.createElement("select");
  groupSelect.className = "planner-select-native";
  const plannerGroupOptions = [
    "Bu gün",
    "Növbəti 48 saat",
    "Növbəti 72 saat",
    "Növbəti 7 gün",
    "Növbəti 14 gün",
    "Növbəti 30 gün",
    "Növbəti 60 gün",
    "Ümumi",
  ];
  plannerGroupOptions.forEach((opt) => {
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

  const submitBtn = button("", "planner-submit-btn");
  submitBtn.type = "submit";
  submitBtn.setAttribute("aria-label", "Tapşırığı əlavə et");
  submitBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>
    </svg>
  `;

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

  // Lightweight search and filter toolbar
  const toolbar = element("div", "planner-toolbar");
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
  toolbar.append(searchBar, filterRow);
  view.appendChild(toolbar);

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
      const empty = element("div", "planner-empty-state");
      empty.append(
        element("h2", "", "Tapşırıq tapılmadı"),
        element("p", "", "Filteri dəyiş və ya yeni tapşırıq əlavə et.")
      );
      listContainer.appendChild(empty);
      return;
    }

    // Group by groupLabel
    const groupOrder = [
      "Bu gün",
      "Növbəti 48 saat",
      "Növbəti 72 saat",
      "Növbəti 7 gün",
      "Bu həftə",
      "Növbəti 14 gün",
      "Növbəti 30 gün",
      "Növbəti 60 gün",
      "Ümumi",
    ];
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
      const isCollapsible = groupName === "Ümumi";
      const isCollapsed = isCollapsible && state.plannerCollapsedGroups.has(groupName);
      const groupHeader = isCollapsible
        ? button("", "planner-group-header is-collapsible")
        : element("div", "planner-group-header");
      const activeCount = groupTasks.filter((t) => !t.completed).length;
      const groupTitle = element("div", "planner-group-title");
      groupTitle.append(
        element("h3", "planner-group-name", groupName.toUpperCase()),
        element("span", "planner-group-badge", `${activeCount} aktiv`)
      );
      groupHeader.appendChild(groupTitle);
      if (isCollapsible) {
        groupHeader.setAttribute("aria-expanded", String(!isCollapsed));
        groupHeader.setAttribute("aria-label", `Ümumi tapşırıqları ${isCollapsed ? "aç" : "bağla"}`);
        groupHeader.insertAdjacentHTML("beforeend", `
          <svg class="planner-group-chevron" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        `);
        if (isCollapsed) groupHeader.classList.add("is-collapsed");
        groupHeader.addEventListener("click", () => {
          if (state.plannerCollapsedGroups.has(groupName)) state.plannerCollapsedGroups.delete(groupName);
          else state.plannerCollapsedGroups.add(groupName);
          drawPlannerList();
        });
      }
      groupEl.appendChild(groupHeader);

      const taskList = element("div", "planner-task-list");
      taskList.hidden = isCollapsed;
      groupTasks.forEach((task) => {
        const card = element("div", `planner-task-card${task.completed ? " is-done" : ""}`);

        const cardMain = element("div", "planner-card-main");

        // Custom checkbox
        const checkWrap = element("label", "planner-check-wrap");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(task.completed);
        const customBox = element("span", "planner-custom-checkbox");
        checkWrap.append(checkbox, customBox);

        const textEl = element("p", "planner-task-text", task.text);

        const menuWrap = element("div", "planner-menu-wrap");
        const menuBtn = button("", "planner-menu-btn", (e) => {
          e.stopPropagation();
          const existingMenu = menuWrap.querySelector(".planner-dropdown-menu");
          document.querySelectorAll(".planner-dropdown-menu").forEach((m) => m.remove());
          document.querySelectorAll(".planner-task-card.has-open-menu").forEach((c) => c.classList.remove("has-open-menu"));
          if (existingMenu) return;

          card.classList.add("has-open-menu");
          const dropdown = element("div", "planner-dropdown-menu");
          if (task.strategyTitle) {
            const sourceItem = button("", "planner-dropdown-item planner-dropdown-source", (ev) => {
              ev.stopPropagation();
              dropdown.remove();
              card.classList.remove("has-open-menu");
              if (task.strategyId) openSavedStrategy(task.strategyId);
              else {
                state.mode = "build";
                state.view = "list";
                render();
              }
            });
            sourceItem.innerHTML = `
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              <span class="planner-dropdown-source-copy"><small>Mənbə</small><strong>${task.strategyTitle}</strong></span>
            `;
            dropdown.appendChild(sourceItem);
          }
          if (task.createdAt) {
            const timeItem = element("div", "planner-dropdown-item planner-dropdown-time");
            timeItem.innerHTML = `
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span class="planner-dropdown-source-copy"><small>Əlavə edilib</small><strong>${formatDate(task.createdAt)}</strong></span>
            `;
            dropdown.appendChild(timeItem);
          }
          const deleteItem = button("", "planner-dropdown-item is-danger", async (ev) => {
            ev.stopPropagation();
            dropdown.remove();
            card.classList.remove("has-open-menu");
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
            <circle cx="5" cy="12" r="1.8"/>
            <circle cx="12" cy="12" r="1.8"/>
            <circle cx="19" cy="12" r="1.8"/>
          </svg>
        `;
        menuWrap.appendChild(menuBtn);

        cardMain.append(checkWrap, textEl, menuWrap);

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

        card.appendChild(cardMain);
        taskList.appendChild(card);
      });

      groupEl.appendChild(taskList);
      listContainer.appendChild(groupEl);
    });
  };

  const onDocClick = (e) => {
    if (!e.target.closest(".planner-menu-wrap")) {
      document.querySelectorAll(".planner-dropdown-menu").forEach((m) => m.remove());
      document.querySelectorAll(".planner-task-card.has-open-menu").forEach((c) => c.classList.remove("has-open-menu"));
    }
  };
  if (window._marketifyPlannerDocClick) {
    document.removeEventListener("click", window._marketifyPlannerDocClick);
  }
  window._marketifyPlannerDocClick = onDocClick;
  document.addEventListener("click", onDocClick);

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
        <strong>✦ Süni İntellekt və API İnfrastrukturu</strong>
        Marketify AI strateji analizlərin, marketinq materiallarının və digər nəticələrin generasiyası üçün süni intellekt, böyük dil modelləri (LLM), API infrastrukturları və digər üçüncü tərəf texnologiyalarından istifadə edə bilər. İstifadə olunan modellər, provayderlər və texniki infrastruktur xidmətin inkişafı ilə əlaqədar dəyişdirilə bilər.
      </div>

      <h3>1. Ümumi Müddəalar və Xidmətin Təyinatı</h3>
      <p>Marketify AI platformasına (“Marketify”, “Platforma”, “Xidmət”) xoş gəlmisiniz. Bu İstifadə Şərtləri (“Şərtlər”) Platformaya girişinizi və ondan istifadənizi tənzimləyir. Platformaya daxil olmaqla və ya ondan istifadə etməklə bu Şərtləri oxuduğunuzu, başa düşdüyünüzü və onlara əməl etməyə razı olduğunuzu təsdiq edirsiniz. Şərtlərlə razı deyilsinizsə, Platformadan istifadə etməməlisiniz.</p>

      <p>Marketify süni intellekt texnologiyalarından istifadə etməklə marketinq, biznes strategiyası, bazar analizi, ideya inkişafı, planlaşdırma və əlaqəli sahələr üzrə məzmun və analitik nəticələr yaratmağa kömək edən proqram təminatı platformasıdır.</p>

      <p>Platformanın təqdim etdiyi nəticələr avtomatlaşdırılmış süni intellekt sistemləri tərəfindən generasiya edilir və peşəkar hüquqi, maliyyə, vergi, investisiya və ya digər ixtisaslaşdırılmış məsləhətin əvəzi hesab edilmir.</p>

      <h3>2. Süni İntellekt Emalı və Üçüncü Tərəf Xidmətləri</h3>
      <p>Platformaya daxil etdiyiniz sorğular, biznes brifləri, mətnlər, fayllar və digər məlumatlar Xidmətin funksiyalarını təmin etmək məqsədilə süni intellekt modelləri, API-lər, hosting, məlumat bazası və digər texniki infrastrukturlar vasitəsilə emal edilə bilər.</p>

      <p>Marketify konkret süni intellekt modelinin, API provayderinin və ya digər üçüncü tərəf xidmətinin daimi mövcudluğuna zəmanət vermir. Marketify istifadə olunan modelləri, provayderləri və texniki infrastrukturu tətbiq olunan qanunvericiliyin tələb etdiyi hallar istisna olmaqla dəyişdirmək hüququnu özündə saxlayır.</p>

      <h3>3. Süni İntellekt Nəticələrinin Dəqiqliyi</h3>
      <p>Süni intellekt sistemlərinin xüsusiyyətlərinə görə Platforma tərəfindən generasiya olunan nəticələr yanlış, natamam, qeyri-dəqiq və ya köhnəlmiş məlumatlar ehtiva edə bilər. Sistem bəzi hallarda mövcud olmayan faktları, statistik məlumatları, mənbələri və ya digər məlumatları səhvən təqdim edə bilər.</p>

      <p>Marketify generasiya edilən nəticələrin dəqiqliyinə, tamlığına, aktuallığına, etibarlılığına və ya konkret məqsədə uyğunluğuna zəmanət vermir. İstifadəçi mühüm məlumatları müstəqil və etibarlı mənbələrdən yoxlamalıdır.</p>

      <h3>4. Əqli Mülkiyyət və İstifadəçi Məzmunu</h3>
      <p><strong>İstifadəçi Məzmunu:</strong> Platformaya daxil etdiyiniz biznes məlumatları, ideyalar, briflər, mətnlər, fayllar və digər materiallar üzərində mövcud hüquqlarınız sizdə qalır.</p>

      <p>Marketify-a məlumat təqdim etməklə həmin məlumatların Xidmətin funksiyalarını yerinə yetirmək üçün zəruri həcmdə emal edilməsinə icazə verirsiniz. Platformaya təqdim etdiyiniz məlumatlardan istifadə etmək və onların emalına icazə vermək üçün zəruri hüquq və səlahiyyətlərə malik olduğunuza görə məsuliyyət daşıyırsınız.</p>

      <p><strong>Generasiya Edilən Məzmun:</strong> Qanunvericiliyin və tətbiq olunan üçüncü tərəf şərtlərinin icazə verdiyi həddə Marketify vasitəsilə sizin üçün generasiya edilmiş strategiya, fəaliyyət planı, mətn və digər nəticələrdən kommersiya və qeyri-kommersiya məqsədləri üçün istifadə edə bilərsiniz.</p>

      <p>Süni intellekt sistemlərinin xüsusiyyətlərinə görə eyni və ya oxşar nəticələr digər istifadəçilər üçün də generasiya edilə bilər. Marketify generasiya edilmiş məzmunun unikal, eksklüziv və ya müəllif hüquqları ilə qoruna bilən olmasına zəmanət vermir.</p>

      <h3>5. Biznes Qərarları və Tövsiyə Xarakteri</h3>
      <p>Marketify tərəfindən generasiya edilən strategiyalar, proqnozlar, bazar təhlilləri, büdcə təklifləri, fəaliyyət planları və digər nəticələr məlumatlandırıcı və yardımçı xarakter daşıyır.</p>

      <p>Marketify müəyyən satış, gəlir, mənfəət, investisiya nəticəsinə, marketinq kampaniyasının uğuruna və ya digər konkret biznes nəticəsinə zəmanət vermir. Platformanın təqdim etdiyi məlumatlara əsaslanan qərarların qəbul edilməsi və həyata keçirilməsi istifadəçinin müstəqil qərarı və məsuliyyətidir.</p>

      <h3>6. Qadağan Olunmuş İstifadə</h3>
      <p>Platformadan qanunsuz fəaliyyət, fırıldaqçılıq, aldatma, üçüncü şəxslərin hüquqlarının pozulması, zərərli proqramların yayılması, sistemlərə icazəsiz giriş, təhlükəsizlik mexanizmlərinin aşılması və ya Platformanın normal fəaliyyətinə müdaxilə məqsədilə istifadə etmək qadağandır.</p>

      <p>Marketify bu Şərtlərin pozulduğunu əsaslı şəkildə müəyyən etdikdə istifadəçinin Platformaya girişini məhdudlaşdırmaq, müvəqqəti dayandırmaq və ya ləğv etmək hüququnu özündə saxlayır.</p>

      <h3>7. Xidmətin Mövcudluğu və Dəyişdirilməsi</h3>
      <p>Marketify Platformanın fasiləsiz, səhvsiz və ya hər zaman əlçatan olacağına zəmanət vermir. Texniki xidmət, yeniləmələr, server problemləri, üçüncü tərəf API-lərində nasazlıqlar və Marketify-ın ağlabatan nəzarətindən kənar digər hallar Xidmətin müvəqqəti əlçatmaz olmasına və ya müəyyən funksiyaların işləməməsinə səbəb ola bilər.</p>

      <p>Marketify Platformanın funksiyalarını, interfeysini, süni intellekt modellərini, istifadə limitlərini və digər texniki xüsusiyyətlərini dəyişdirmək, əlavə etmək və ya dayandırmaq hüququnu özündə saxlayır.</p>

      <h3>8. Zəmanətlərin Məhdudlaşdırılması</h3>
      <p>Qanunvericiliyin icazə verdiyi maksimum həddə Platforma və onun funksiyaları “olduğu kimi” və “mövcud olduğu şəkildə” təqdim edilir.</p>

      <p>Marketify Platformanın konkret məqsədə uyğunluğu, fasiləsiz işləməsi, bütün səhvlərdən azad olması və ya generasiya edilən nəticələrin konkret kommersiya və ya biznes nəticəsi yaradacağı barədə açıq və ya nəzərdə tutulan zəmanət vermir.</p>

      <h3>9. Məsuliyyətin Məhdudlaşdırılması</h3>
      <p>Qanunvericiliyin icazə verdiyi maksimum həddə Marketify Platformadan istifadə, Platformadan istifadə edə bilməmə və ya generasiya edilmiş nəticələrə əsaslanan qərarlar nəticəsində yaranan dolayı, təsadüfi, xüsusi və ya nəticə etibarilə meydana çıxan zərərlərə, o cümlədən itirilmiş mənfəət, gəlir, biznes imkanı, məlumat və ya reputasiya itkisinə görə məsuliyyət daşımır.</p>

      <p>Bu müddəa tətbiq olunan qanunvericiliklə məhdudlaşdırılması və ya istisna edilməsi mümkün olmayan məsuliyyət hallarını aradan qaldırmır.</p>

      <h3>10. Hesab və Təhlükəsizlik</h3>
      <p>Hesab funksiyası təqdim edildiyi halda istifadəçi öz giriş məlumatlarının məxfiliyini və təhlükəsizliyini qorumağa görə məsuliyyət daşıyır. İcazəsiz giriş və ya hesab təhlükəsizliyinin pozulmasından şübhələndikdə istifadəçi Marketify-a mümkün qədər tez məlumat verməlidir.</p>

      <h3>11. Məxfilik və Fərdi Məlumatlar</h3>
      <p>Fərdi məlumatların toplanması, istifadəsi, saxlanması və digər emal əməliyyatları Marketify-ın qüvvədə olan Məxfilik Siyasətinə və tətbiq olunan qanunvericiliyə uyğun həyata keçirilir.</p>

      <p>İstifadəçilər Platformaya xidmətin göstərilməsi üçün zəruri olmayan həssas, məxfi və ya üçüncü şəxslərə aid məlumatları daxil etməməlidirlər.</p>

      <h3>12. Şərtlərin Dəyişdirilməsi</h3>
      <p>Marketify Platformanın inkişafı, hüquqi tələblər, təhlükəsizlik məsələləri və ya xidmət modelində dəyişikliklərlə əlaqədar bu Şərtləri vaxtaşırı yeniləyə bilər. Əhəmiyyətli dəyişikliklər barədə tətbiq olunan qanunvericiliyin tələb etdiyi hallarda istifadəçilərə uyğun vasitələrlə məlumat verilə bilər.</p>

      <p>Yenilənmiş Şərtlər göstərilən qüvvəyə minmə tarixindən tətbiq edilir.</p>

      <h3>13. Şərtlərin Ayrı-ayrılıqda Qüvvədə Qalması</h3>
      <p>Bu Şərtlərin hər hansı müddəasının etibarsız və ya icraedilməz hesab edilməsi digər müddəaların etibarlılığına təsir göstərmir.</p>

      <h3>14. Tətbiq Olunan Qanunvericilik</h3>
      <p>Bu Şərtlər Azərbaycan Respublikasının qanunvericiliyinə uyğun olaraq şərh və tətbiq edilir. İstehlakçıların və digər şəxslərin tətbiq olunan qanunvericiliklə məhdudlaşdırılması mümkün olmayan hüquqları bu Şərtlərlə aradan qaldırılmır.</p>

      <div class="legal-highlight-box">
        <strong>Vacib qeyd</strong>
        Marketify səhv edə bilər. Vacib məlumatları və Platformanın təqdim etdiyi nəticələri müstəqil və etibarlı mənbələrdən yoxlayın.
      </div>
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

function openPersonalizationConsentModal(onAccept) {
  const overlay = document.querySelector("#legalModalOverlay");
  if (!overlay) return;

  overlay.replaceChildren();

  const card = element("div", "legal-modal-card personalization-consent-card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "personalizationConsentTitle");

  const header = element("header", "legal-modal-header");
  const titleGroup = element("div", "legal-modal-title-group");
  const title = element("h2", "", "Fərdiləşdirilmiş təcrübəni aktivləşdir?");
  title.id = "personalizationConsentTitle";
  titleGroup.append(
    title,
    element("p", "", "Daha uyğun cavablar üçün brend məlumatlarından istifadə et.")
  );

  const closeBtn = button("✕", "legal-modal-close", closeLegalModal);
  closeBtn.setAttribute("aria-label", "Bağla");
  header.append(titleGroup, closeBtn);

  const body = element("div", "legal-modal-body personalization-consent-body");
  body.append(
    element(
      "p",
      "",
      "Aktiv olduqda Marketify cavabları və strategiyaları brend profilin, seçdiyin üslub və yaddaş qeydlərin əsasında fərdiləşdirəcək."
    ),
    element(
      "p",
      "",
      "Bu funksiya könüllüdür və istənilən vaxt Parametrlər bölməsindən söndürülə bilər."
    )
  );

  const privacyLink = element(
    "a",
    "personalization-consent-privacy-link",
    "Məxfilik Siyasətini oxu →"
  );
  privacyLink.href = "#privacy";
  privacyLink.addEventListener("click", (event) => {
    event.preventDefault();
    openLegalModal("privacy");
  });
  body.appendChild(privacyLink);

  const footer = element("div", "legal-modal-footer personalization-consent-footer");
  const cancelBtn = button("İndi yox", "secondary-button", closeLegalModal);
  const acceptBtn = button("Razıyam, aktiv et", "primary-button", () => {
    closeLegalModal();
    if (typeof onAccept === "function") onAccept();
  });
  footer.append(cancelBtn, acceptBtn);

  card.append(header, body, footer);
  overlay.appendChild(card);
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  acceptBtn.focus();
}

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

window.addEventListener("marketify:open-legal", (event) => {
  openLegalModal(event.detail?.type || "terms");
});

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

function openLegalReportModal({ messageContent = "", model = "" } = {}) {
  const overlay = document.querySelector("#legalModalOverlay");
  if (!overlay) return;

  overlay.replaceChildren();
  const card = element("div", "legal-modal-card legal-report-modal-card");

  const header = element("header", "legal-modal-header");
  const titleGroup = element("div", "legal-modal-title-group");
  titleGroup.append(
    element("h2", "", "Hüquqi problem bildir"),
    element("p", "", "Süni intellekt cavabı ilə bağlı hüquqi narahatlıq və ya pozuntu bildirin")
  );

  const closeBtn = button("✕", "legal-modal-close", closeLegalModal);
  closeBtn.setAttribute("aria-label", "Bağla");
  header.append(titleGroup, closeBtn);

  const body = element("div", "legal-modal-body legal-report-modal-body");

  const noticeBox = element("div", "legal-report-notice-box");
  noticeBox.innerHTML = `
    <div class="legal-report-notice-icon">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    </div>
    <div class="legal-report-notice-text">
      Süni intellekt cavablarında qeyri-dəqiqlik və ya səhvlər ola bilər və onlar peşəkar məsləhət kimi qəbul edilməməlidir. Ətraflı məlumat üçün <button type="button" class="legal-report-terms-link" id="legalReportTermsLink">İstifadə şərtləri</button> ilə tanış olun.
    </div>
  `;
  noticeBox.querySelector("#legalReportTermsLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    openLegalModal("terms");
  });
  body.appendChild(noticeBox);

  const form = document.createElement("form");
  form.className = "legal-report-form";

  if (messageContent) {
    const previewBox = element("div", "legal-report-context-box");
    const previewHeader = element("div", "legal-report-context-header");
    const previewLabel = element("span", "legal-report-context-label", "İstinad edilən cavab");
    const modelBadge = element("span", "legal-report-model-pill", model ? `Model: ${model}` : "AI Cavabı");
    previewHeader.append(previewLabel, modelBadge);

    const previewText = element("div", "legal-report-context-preview");
    previewText.textContent = messageContent.length > 350 ? messageContent.slice(0, 350) + "…" : messageContent;
    previewBox.append(previewHeader, previewText);
    form.appendChild(previewBox);
  }

  const typeField = element("div", "legal-report-field");
  const typeLabel = element("label", "legal-report-label");
  typeLabel.innerHTML = `<span>Problem növü</span> <span class="required-star">*</span>`;

  const typeSelect = document.createElement("select");
  typeSelect.className = "legal-report-select";
  typeSelect.required = true;

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Problem növünü seçin…";
  defaultOption.disabled = true;
  defaultOption.selected = true;
  typeSelect.appendChild(defaultOption);

  const issueTypes = [
    "Müəllif hüquqları və əqli mülkiyyət pozuntusu",
    "Fərdi məlumatlar və məxfilik pozuntusu",
    "Yanlış, zərərli və ya təhlükəli hüquqi məlumat",
    "Ticarət nişanı və ya brend hüquqlarının pozulması",
    "Digər hüquqi problem",
  ];

  issueTypes.forEach((text) => {
    const opt = document.createElement("option");
    opt.value = text;
    opt.textContent = text;
    typeSelect.appendChild(opt);
  });
  typeField.append(typeLabel, typeSelect);
  form.appendChild(typeField);

  const descField = element("div", "legal-report-field");
  const descLabel = element("label", "legal-report-label");
  descLabel.innerHTML = `<span>Problem haqqında təsvir</span> <span class="required-star">*</span>`;

  const descTextarea = document.createElement("textarea");
  descTextarea.className = "legal-report-textarea";
  descTextarea.rows = 4;
  descTextarea.maxLength = 4000;
  descTextarea.required = true;
  descTextarea.placeholder = "Problemin mahiyyətini və narahatlığınızı ətraflı izah edin…";

  const descHint = element("span", "legal-report-hint", "Müraciətiniz hüquqi məxfilik qaydalarına uyğun araşdırılacaqdır.");
  descField.append(descLabel, descTextarea, descHint);
  form.appendChild(descField);

  const emailField = element("div", "legal-report-field");
  const emailLabel = element("label", "legal-report-label");
  emailLabel.innerHTML = `<span>Əlaqə üçün e-poçt ünvanınız</span> <span class="optional-tag">(istəyə bağlı)</span>`;

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.className = "legal-report-input";
  emailInput.maxLength = 250;
  emailInput.placeholder = "adiniz@example.com";
  if (state.currentUser && state.currentUser.email) {
    emailInput.value = state.currentUser.email;
  }
  const emailHint = element("span", "legal-report-hint", "Müraciətinizlə bağlı sizə geri dönüş edə bilməyimiz üçün.");
  emailField.append(emailLabel, emailInput, emailHint);
  form.appendChild(emailField);

  const errorBox = element("div", "legal-report-error");
  errorBox.style.display = "none";
  form.appendChild(errorBox);

  body.appendChild(form);

  const footer = element("div", "legal-modal-footer legal-report-modal-footer");
  const cancelBtn = button("İmtina et", "secondary-button", closeLegalModal);
  cancelBtn.type = "button";

  const submitBtn = button("Bildirişi göndər", "primary-button legal-report-submit-btn");
  submitBtn.type = "button";

  const doSubmit = async (e) => {
    if (e) e.preventDefault();
    errorBox.style.display = "none";
    errorBox.textContent = "";

    const selectedType = typeSelect.value.trim();
    const description = descTextarea.value.trim();
    const userEmail = emailInput.value.trim();

    if (!selectedType) {
      errorBox.textContent = "Zəhmət olmasa problem növünü seçin.";
      errorBox.style.display = "block";
      typeSelect.focus();
      return;
    }

    if (!description || description.length < 5) {
      errorBox.textContent = "Zəhmət olmasa problem haqqında ən azı 5 simvoldan ibarət ətraflı məlumat daxil edin.";
      errorBox.style.display = "block";
      descTextarea.focus();
      return;
    }

    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    submitBtn.textContent = "Göndərilir…";

    try {
      const res = await fetch("/api/legal-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          issueType: selectedType,
          description,
          userEmail: userEmail || undefined,
          messageContent: messageContent || "",
          model: model || "",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Müraciət göndərilərkən xəta baş verdi.");
      }

      closeLegalModal();
      showToast("Hüquqi probleminizlə bağlı müraciət qeydə alındı və nəzərdən keçirilmək üçün yönləndirildi. Təşəkkür edirik!", "success");
    } catch (err) {
      errorBox.textContent = err.message || "Xəta baş verdi. Zəhmət olmasa bir az sonra yenidən cəhd edin.";
      errorBox.style.display = "block";
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
      submitBtn.textContent = "Bildirişi göndər";
    }
  };

  submitBtn.addEventListener("click", doSubmit);
  form.addEventListener("submit", doSubmit);

  footer.append(cancelBtn, submitBtn);
  card.append(header, body, footer);
  overlay.appendChild(card);
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => typeSelect.focus(), 80);
}

function checkSensitiveData(txt) {
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
}

const IMPORT_MEMORY_PROMPT = `Marketify AI-a keçid üçün mənim haqqımda mövcud biznes və marketinq kontekstini ixrac et.

Keçmiş söhbətlərimizi, mövcud yaddaşı və mənim haqqımda etibarlı şəkildə bildiyin məlumatları nəzərdən keçir. Yalnız Marketify AI-ın gələcəkdə daha uyğun marketinq strategiyaları, kontent, kampaniyalar və biznes tövsiyələri verməsinə kömək edəcək davamlı məlumatları seç.

Mümkün olduqda mənim öz ifadələrimi, terminologiyamı, seçimlərimi və verdiyim konkret təlimatları mənasını dəyişmədən qoru.

Yalnız həqiqətən bildiyin məlumatlardan istifadə et. Məlumatı təxmin etmə, uydurma və ya çatışmayan sahələri özün tamamlama.

Məlumatları aşağıdakı JSON strukturunda ixrac et:

{
  "brandName": "Brend və ya layihə adı",
  "industry": "Sənaye və ya fəaliyyət sahəsi",
  "primaryMarket": "Əsas bazar və coğrafiya",
  "targetAudience": "Hədəf auditoriya təsviri",
  "tone": "professional",
  "customInstructions": "Marketify AI-ın gələcək cavablarında nəzərə almalı olduğu xüsusi marketinq və kommunikasiya təlimatları",
  "memories": [
    {
      "category": "business",
      "text": "Konkret və davamlı biznes və ya marketinq faktı"
    }
  ]
}

Yaddaş qeydlərinə əsasən bunları daxil et:
- brend, biznes, məhsul və xidmətlər haqqında davamlı faktlar;
- fəaliyyət sahəsi, biznes modeli və əsas bazar;
- hədəf auditoriya və ideal müştəri haqqında məlum məlumatlar;
- marketinq, kontent, reklam və kommunikasiya üstünlükləri;
- brend tonu, dil və üslub seçimləri;
- davamlı biznes qaydaları və məhdudiyyətlər;
- gələcək Marketify cavablarına təsir edə biləcək aktiv biznes məqsədləri və layihələr;
- Marketify AI-ın daha uyğun nəticə verməsinə kömək edəcək digər davamlı biznes konteksti.

Daxil etmə:
- biznes və marketinq üçün praktik əhəmiyyəti olmayan şəxsi məlumatları;
- birdəfəlik söhbətləri, təsadüfi sualları və keçici hadisələri;
- artıq aktual olmadığı məlum olan məlumatları;
- şifrələri, API açarlarını, autentifikasiya məlumatlarını, telefon nömrələrini, dəqiq ünvanları, kart və bank məlumatlarını;
- sağlamlıq, siyasi baxışlar və mənsubiyyət, dini inanclar, etnik mənsubiyyət, cinsi həyat və ya oriyentasiya kimi həssas şəxsi məlumatları.

Qaydalar:
1. Cavab yalnız sintaktik olaraq etibarlı JSON olmalıdır. Markdown code block, giriş, izah, qeyd və ya əlavə mətn yazma.
2. "tone" yalnız bu dəyərlərdən biri ola bilər: "professional", "creative", "concise", "friendly", "data_driven".
3. İstifadəçinin üslub seçimi məlum deyilsə "tone": "professional" istifadə et.
4. "category" yalnız bu dəyərlərdən biri ola bilər: "business", "audience", "preference", "constraint", "general".
5. Hər "memories" elementi yalnız bir konkret fakt, üstünlük və ya qayda ifadə etməlidir.
6. Eyni və ya çox oxşar yaddaş faktlarını təkrarlama.
7. Məlum olmayan əsas sahələr üçün boş string ("") istifadə et.
8. Uyğun yaddaş faktı yoxdursa "memories": [] qaytar.
9. "customInstructions" daxilində faktları sadalamaq əvəzinə Marketify AI-ın gələcək cavablarını necə uyğunlaşdırmalı olduğunu qısa şəkildə ifadə et.
10. Bütün key və string-lər double quote ilə yazılmalı və trailing comma istifadə edilməməlidir.

Yalnız JSON qaytar.`;

function parseImportedMemoryText(raw) {
  if (!raw || typeof raw !== "string") {
    return { brandName: "", industry: "", primaryMarket: "", targetAudience: "", tone: "professional", customInstructions: "", memories: [], sensitiveExcluded: 0 };
  }

  const text = raw.trim();
  let parsedJson = null;

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonCandidate = codeBlockMatch ? codeBlockMatch[1].trim() : text;

  try {
    parsedJson = JSON.parse(jsonCandidate);
  } catch {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsedJson = JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {}
    }
    if (!parsedJson) {
      const firstBracket = text.indexOf("[");
      const lastBracket = text.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        try {
          parsedJson = JSON.parse(text.slice(firstBracket, lastBracket + 1));
        } catch {}
      }
    }
  }

  let brandName = "";
  let industry = "";
  let primaryMarket = "";
  let targetAudience = "";
  let tone = "professional";
  let customInstructions = "";
  let rawMemories = [];
  let sensitiveExcluded = 0;

  const validTones = new Set(["professional", "creative", "concise", "friendly", "data_driven"]);
  const validCategories = new Set(["business", "audience", "preference", "constraint", "general"]);

  function sanitizeCategory(cat, txt = "") {
    const c = String(cat || "").toLowerCase().trim();
    if (validCategories.has(c)) return c;
    if (c.includes("biznes") || c.includes("business") || c.includes("fakt")) return "business";
    if (c.includes("auditor") || c.includes("kütlə") || c.includes("müştəri") || c.includes("audience")) return "audience";
    if (c.includes("üstün") || c.includes("pref") || c.includes("istək")) return "preference";
    if (c.includes("məhdud") || c.includes("qadağa") || c.includes("constrain") || c.includes("limit")) return "constraint";
    const lowerTxt = String(txt).toLowerCase();
    if (/(?:etmirik|olmaz|qadağandır|istifadə etmirik|don't|never|no tv|no radio|heç vaxt)/i.test(lowerTxt)) return "constraint";
    if (/(?:yaş|auditoriya|müştəri|gənc|qadın|kişi|segment|b2b|b2c)/i.test(lowerTxt)) return "audience";
    if (/(?:üstünlük|sevirik|əsasən|tərz|prioritet)/i.test(lowerTxt)) return "preference";
    if (/(?:şirkət|məhsul|xidmət|satış|qiymət|brend|biznes)/i.test(lowerTxt)) return "business";
    return "general";
  }

  if (parsedJson && typeof parsedJson === "object") {
    if (Array.isArray(parsedJson)) {
      rawMemories = parsedJson;
    } else {
      brandName = String(parsedJson.brandName || parsedJson.brand || parsedJson.name || "").trim().slice(0, 100);
      industry = String(parsedJson.industry || parsedJson.sector || parsedJson.sahə || "").trim().slice(0, 100);
      primaryMarket = String(parsedJson.primaryMarket || parsedJson.market || parsedJson.bazar || parsedJson.geography || "").trim().slice(0, 100);
      targetAudience = String(parsedJson.targetAudience || parsedJson.audience || parsedJson.hədəf || "").trim().slice(0, 500);
      if (validTones.has(parsedJson.tone)) tone = parsedJson.tone;
      customInstructions = String(parsedJson.customInstructions || parsedJson.instructions || parsedJson.təlimatlar || "").trim().slice(0, 2000);

      const memCandidate = parsedJson.memories || parsedJson.memory || parsedJson.facts || parsedJson.knowledge || parsedJson.items || parsedJson.qeydlər;
      if (Array.isArray(memCandidate)) {
        rawMemories = memCandidate;
      }
    }
  } else {
    const lines = text.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const brandMatch = line.match(/^(?:brend|brand|layihə|şirkət)\s*[:=]\s*(.+)$/i);
      if (brandMatch && !brandName) { brandName = brandMatch[1].trim().slice(0, 100); continue; }

      const industryMatch = line.match(/^(?:sənaye|sahə|industry|sector)\s*[:=]\s*(.+)$/i);
      if (industryMatch && !industry) { industry = industryMatch[1].trim().slice(0, 100); continue; }

      const marketMatch = line.match(/^(?:bazar|coğrafiya|market|region)\s*[:=]\s*(.+)$/i);
      if (marketMatch && !primaryMarket) { primaryMarket = marketMatch[1].trim().slice(0, 100); continue; }

      const audienceMatch = line.match(/^(?:hədəf(?:\s*kütlə|\s*auditoriya)?|audience|target)\s*[:=]\s*(.+)$/i);
      if (audienceMatch && !targetAudience) { targetAudience = audienceMatch[1].trim().slice(0, 500); continue; }

      const toneMatch = line.match(/^(?:üslub|ton|tone|voice)\s*[:=]\s*(.+)$/i);
      if (toneMatch) {
        const tVal = toneMatch[1].trim().toLowerCase();
        if (validTones.has(tVal)) tone = tVal;
        continue;
      }

      const instrMatch = line.match(/^(?:təlimat(?:lar)?|instructions?|qaydalar)\s*[:=]\s*(.+)$/i);
      if (instrMatch && !customInstructions) { customInstructions = instrMatch[1].trim().slice(0, 2000); continue; }

      const bulletMatch = line.match(/^(?:[-*•+]|\d+[.)])\s*(.+)$/);
      if (bulletMatch) {
        const itemTxt = bulletMatch[1].trim();
        if (itemTxt) rawMemories.push(itemTxt);
      }
    }
  }

  const memories = [];
  const seen = new Set();

  for (const item of rawMemories) {
    let itemText = "";
    let itemCat = "general";

    if (typeof item === "string") {
      itemText = item.trim();
      itemCat = sanitizeCategory("", itemText);
    } else if (item && typeof item === "object") {
      itemText = String(item.text || item.fact || item.note || item.content || item.value || "").trim();
      itemCat = sanitizeCategory(item.category || item.type || item.cat, itemText);
    }

    if (!itemText) continue;
    itemText = itemText.slice(0, 500);

    const norm = itemText.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);

    const sensitive = checkSensitiveData(itemText);
    if (sensitive) {
      sensitiveExcluded += 1;
      continue;
    }

    memories.push({
      id: `mem_imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      text: itemText,
      category: itemCat,
      selected: true,
    });
  }

  return {
    brandName,
    industry,
    primaryMarket,
    targetAudience,
    tone,
    customInstructions,
    memories: memories.slice(0, 50),
    sensitiveExcluded,
  };
}

function openImportMemoryModal({ userSettings = {}, onImportSuccess = null } = {}) {
  const overlay = document.querySelector("#legalModalOverlay");
  if (!overlay) return;

  overlay.replaceChildren();

  const card = element("div", "legal-modal-card import-memory-modal-card");

  // Header
  const header = element("header", "legal-modal-header import-memory-modal-header");

  const titleGroup = element("div", "legal-modal-title-group");
  titleGroup.append(
    element("h2", "", "Yaddaşın köçürülməsi"),
    element(
      "p",
      "",
      "Başqa AI xidmətindəki yaddaş və brend məlumatlarını Marketify-a köçür."
    )
  );

  const closeBtn = button("✕", "legal-modal-close", closeLegalModal);
  closeBtn.setAttribute("aria-label", "Bağla");

  header.append(titleGroup, closeBtn);

  const body = element("div", "legal-modal-body import-memory-modal-body");

  // ------------------------------------------------------------
  // STEP 1
  // ------------------------------------------------------------
  const step1 = element("section", "import-step");

  const step1Header = element("div", "import-step-heading");
  step1Header.innerHTML = `
    <span class="import-step-number">1</span>
    <div>
      <strong>Promptu AI xidmətinə göndər</strong>
      <p>ChatGPT, Claude və ya Gemini-yə bu promptu göndər.</p>
    </div>
  `;

  const promptBox = element("div", "import-prompt-box");

  const promptPreview = element("div", "import-prompt-preview");
  promptPreview.textContent = IMPORT_MEMORY_PROMPT;

  const copyBtn = button(
    "Promptu kopyala",
    "secondary-button import-copy-btn",
    async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(IMPORT_MEMORY_PROMPT);
        } else {
          const ta = document.createElement("textarea");
          ta.value = IMPORT_MEMORY_PROMPT;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }

        copyBtn.textContent = "Kopyalandı ✓";
        copyBtn.classList.add("is-copied");

        setTimeout(() => {
          copyBtn.textContent = "Promptu kopyala";
          copyBtn.classList.remove("is-copied");
        }, 1800);

        showToast("Prompt kopyalandı.");
      } catch {
        showToast("Promptu kopyalamaq mümkün olmadı.", "error");
      }
    }
  );

  copyBtn.type = "button";

  promptBox.append(promptPreview, copyBtn);
  step1.append(step1Header, promptBox);

  // ------------------------------------------------------------
  // STEP 2
  // ------------------------------------------------------------
  const step2 = element("section", "import-step");

  const step2Header = element("div", "import-step-heading");
  step2Header.innerHTML = `
    <span class="import-step-number">2</span>
    <div>
      <strong>Cavabı bura yapışdır</strong>
      <p>AI tərəfindən yaradılmış JSON və ya mətn nəticəsini daxil et.</p>
    </div>
  `;

  const textarea = element(
    "textarea",
    "settings-input settings-textarea import-textarea"
  );

  textarea.rows = 5;
  textarea.placeholder = `AI cavabını buraya yapışdır...

{
  "brandName": "Marketify AI",
  "industry": "B2B SaaS",
  "memories": [...]
}`;

  step2.append(step2Header, textarea);

  // ------------------------------------------------------------
  // STEP 3
  // ------------------------------------------------------------
  const step3 = element("section", "import-step import-step-review");

  const step3Header = element("div", "import-step-heading");
  step3Header.innerHTML = `
    <span class="import-step-number">3</span>
    <div>
      <strong>Nəticəni yoxla</strong>
      <p>Aşkarlanan məlumatları nəzərdən keçir və idxal et.</p>
    </div>
  `;

  const previewContainer = element("div", "import-preview-container");

  step3.append(step3Header, previewContainer);

  let currentParsedData = null;
  let importMode = "merge";
  let enablePersonalIntelligence = true;

  function createImportChip(label, value) {
    const chip = element("div", "import-chip");

    chip.innerHTML = `
      <span class="import-chip-label">${escapeHtml(label)}</span>
      <span class="import-chip-val">${escapeHtml(value)}</span>
    `;

    return chip;
  }

  function createModeOption({
    value,
    title,
    description,
    recommended = false,
  }) {
    const label = element(
      "label",
      `import-mode-option${importMode === value ? " is-selected" : ""}`
    );

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "importMode";
    radio.value = value;
    radio.checked = importMode === value;
    radio.className = "import-mode-radio";

    const text = element("div", "import-mode-text");
    text.innerHTML = `
      <strong>
        ${escapeHtml(title)}
        ${recommended ? '<span class="import-recommended">Tövsiyə olunur</span>' : ""}
      </strong>
      <p>${escapeHtml(description)}</p>
    `;

    radio.addEventListener("change", () => {
      importMode = value;

      document
        .querySelectorAll(".import-mode-option")
        .forEach((item) => item.classList.remove("is-selected"));

      label.classList.add("is-selected");
    });

    label.append(radio, text);
    return label;
  }

  const renderPreview = () => {
    previewContainer.replaceChildren();

    const raw = textarea.value.trim();

    if (!raw) {
      const empty = element(
        "div",
        "import-preview-empty",
        "Cavabı yapışdırdıqdan sonra aşkarlanan məlumatlar burada görünəcək."
      );

      previewContainer.appendChild(empty);
      currentParsedData = null;
      return;
    }

    currentParsedData = parseImportedMemoryText(raw);

    const hasProfile = Boolean(
      currentParsedData.brandName ||
        currentParsedData.industry ||
        currentParsedData.primaryMarket ||
        currentParsedData.targetAudience ||
        currentParsedData.customInstructions ||
        (currentParsedData.tone &&
          currentParsedData.tone !== "professional")
    );

    const hasMemories = currentParsedData.memories.length > 0;

    if (!hasProfile && !hasMemories) {
      const warning = element("div", "import-warning-box");

      warning.innerHTML = `
        <strong>Məlumat aşkarlanmadı</strong>
        <p>AI cavabının tam şəkildə kopyalandığından əmin ol.</p>
      `;

      previewContainer.appendChild(warning);
      return;
    }

    // Sensitive data alert
    if (currentParsedData.sensitiveExcluded > 0) {
      const notice = element("div", "import-sensitive-alert");

      notice.innerHTML = `
        <span>
          ${currentParsedData.sensitiveExcluded} həssas məlumat təhlükəsizlik səbəbilə idxaldan çıxarıldı.
        </span>
      `;

      previewContainer.appendChild(notice);
    }

    // Profile
    if (hasProfile) {
      const profileBox = element("div", "import-review-section");

      profileBox.appendChild(
        element("strong", "import-section-subtitle", "Brend və profil")
      );

      const chipGrid = element("div", "import-chips-grid");

      const toneNames = {
        professional: "Peşəkar",
        creative: "Yaradıcı",
        concise: "Qısa və konkret",
        friendly: "Dostcasına",
        data_driven: "Nəticə yönümlü",
      };

      if (currentParsedData.brandName) {
        chipGrid.appendChild(
          createImportChip("Brend", currentParsedData.brandName)
        );
      }

      if (currentParsedData.industry) {
        chipGrid.appendChild(
          createImportChip("Sahə", currentParsedData.industry)
        );
      }

      if (currentParsedData.primaryMarket) {
        chipGrid.appendChild(
          createImportChip("Bazar", currentParsedData.primaryMarket)
        );
      }

      if (currentParsedData.targetAudience) {
        chipGrid.appendChild(
          createImportChip("Auditoriya", currentParsedData.targetAudience)
        );
      }

      if (currentParsedData.tone) {
        chipGrid.appendChild(
          createImportChip(
            "Üslub",
            toneNames[currentParsedData.tone] || currentParsedData.tone
          )
        );
      }

      if (currentParsedData.customInstructions) {
        chipGrid.appendChild(
          createImportChip(
            "Təlimat",
            currentParsedData.customInstructions
          )
        );
      }

      profileBox.appendChild(chipGrid);
      previewContainer.appendChild(profileBox);
    }

    // Memories
    if (hasMemories) {
      const memBox = element("div", "import-review-section");

      const memHeader = element("div", "import-memories-header");

      memHeader.append(
        element(
          "strong",
          "import-section-subtitle",
          `Yaddaş qeydləri · ${currentParsedData.memories.length}`
        ),
        element(
          "span",
          "import-hint-text",
          "İstəmədiyin qeydlərin seçimini sil."
        )
      );

      const list = element("div", "import-memories-list");

      const categoryNames = {
        business: "Biznes",
        audience: "Auditoriya",
        preference: "Üstünlük",
        constraint: "Məhdudiyyət",
        general: "Qeyd",
      };

      currentParsedData.memories.forEach((mem) => {
        const row = element("label", "import-memory-item-row");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "import-memory-checkbox";
        checkbox.checked = mem.selected !== false;

        checkbox.addEventListener("change", () => {
          mem.selected = checkbox.checked;
        });

        const tag = element(
          "span",
          `memory-category-tag tag-${mem.category || "general"}`,
          categoryNames[mem.category] || "Qeyd"
        );

        const text = element("span", "import-memory-text", mem.text);

        row.append(checkbox, tag, text);
        list.appendChild(row);
      });

      memBox.append(memHeader, list);
      previewContainer.appendChild(memBox);
    }

    // Import mode
    const settingsBox = element("div", "import-review-section import-options-box");

    settingsBox.appendChild(
      element("strong", "import-section-subtitle", "İdxal üsulu")
    );

    const modeWrap = element("div", "import-mode-selector");

    modeWrap.append(
      createModeOption({
        value: "merge",
        title: "Mövcud yaddaşla birləşdir",
        description: "Cari məlumatlar qalır, yeni faktlar əlavə olunur.",
        recommended: true,
      }),
      createModeOption({
        value: "replace",
        title: "Yaddaşı əvəzlə",
        description: "Cari yaddaş silinir və yalnız bu məlumatlar saxlanılır.",
      })
    );

    const autoEnableRow = element("label", "import-auto-enable-row");

    const autoEnableCheck = document.createElement("input");
    autoEnableCheck.type = "checkbox";
    autoEnableCheck.className = "import-auto-enable-check";
    autoEnableCheck.checked = enablePersonalIntelligence;

    autoEnableCheck.addEventListener("change", () => {
      enablePersonalIntelligence = autoEnableCheck.checked;
    });

    autoEnableRow.append(
      autoEnableCheck,
      element(
        "span",
        "",
        "Fərdiləşdirilmiş təcrübəni aktiv et"
      )
    );

    settingsBox.append(modeWrap, autoEnableRow);
    previewContainer.appendChild(settingsBox);
  };

  textarea.addEventListener("input", renderPreview);

  renderPreview();

  body.append(step1, step2, step3);

  // ------------------------------------------------------------
  // FOOTER
  // ------------------------------------------------------------
  const footer = element(
    "div",
    "legal-modal-footer import-modal-footer"
  );

  const cancelBtn = button(
    "Ləğv et",
    "secondary-button",
    closeLegalModal
  );

  const confirmBtn = button(
    "Təsdiqlə",
    "primary-button import-confirm-btn",
    async () => {
      if (!currentParsedData) {
        renderPreview();
      }

      if (!currentParsedData) {
        showToast("Əvvəlcə AI cavabını yapışdır.", "error");
        return;
      }

      const selectedMemories = (
        currentParsedData.memories || []
      ).filter((m) => m.selected !== false);

      const hasProfileData = Boolean(
        currentParsedData.brandName ||
          currentParsedData.industry ||
          currentParsedData.primaryMarket ||
          currentParsedData.targetAudience ||
          currentParsedData.customInstructions ||
          (currentParsedData.tone &&
            currentParsedData.tone !== "professional")
      );

      if (!hasProfileData && !selectedMemories.length) {
        showToast(
          "İdxal ediləcək məlumat seçilməyib.",
          "error"
        );
        return;
      }

      const payload = {
        brandName: currentParsedData.brandName || "",
        industry: currentParsedData.industry || "",
        primaryMarket: currentParsedData.primaryMarket || "",
        targetAudience: currentParsedData.targetAudience || "",
        tone: currentParsedData.tone || "professional",
        customInstructions:
          currentParsedData.customInstructions || "",
        memories: selectedMemories.map((m) => ({
          text: m.text,
          category: m.category,
        })),
        mergeMode: importMode,
        enablePersonalIntelligence,
      };

      const importMemory = async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "İdxal edilir…";

        try {
          const res = await authRequest(
            "/api/auth/settings/import-memory",
            {
              method: "POST",
              body: JSON.stringify(payload),
            }
          );

          closeLegalModal();

          if (typeof onImportSuccess === "function") {
            onImportSuccess(res.user);
          } else {
            updateWorkspaceIdentity(res.user);
          }

          showToast(
            `Yaddaş idxal edildi · ${
              res.importedCount || selectedMemories.length
            } fakt`
          );
        } catch (err) {
          showToast(
            err.message || "İdxal zamanı xəta baş verdi.",
            "error"
          );

          confirmBtn.disabled = false;
          confirmBtn.textContent = "Yaddaşı köçür";
        }
      };

      if (enablePersonalIntelligence && userSettings.personalIntelligence !== true) {
        openPersonalizationConsentModal(importMemory);
        return;
      }

      await importMemory();
    }
  );

  confirmBtn.type = "button";

  footer.append(cancelBtn, confirmBtn);

  card.append(header, body, footer);
  overlay.appendChild(card);

  overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

window.addEventListener("marketify:account-restored", () => {
  showToast("Xoş gəldiniz! 14 günlük silinmə sorğusu ləğv edildi və hesabınız bərpa olundu.", "success");
});

function navigateHome() {
  if (state.view !== "home") {
    state.view = "home";
    syncMode();
    syncNav();
    render();
  } else {
    if (state.mode === "ask") startNewChat();
    else resetStrategy();
  }
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
railHomeButton.addEventListener("click", navigateHome);
railStrategiesButton.addEventListener("click", () => {
  state.view = "list";
  syncNav();
  render();
  closeSidebar();
});
railPlannerButton?.addEventListener("click", () => {
  state.view = "planner";
  syncNav();
  render();
  closeSidebar();
});
railLimitsButton?.addEventListener("click", () => {
  state.view = "limits";
  syncNav();
  render();
  closeSidebar();
});
sidebarClose.addEventListener("click", closeSidebar);
mobileOverlay.addEventListener("click", closeSidebar);
document.querySelectorAll(".brand").forEach((brandEl) => {
  brandEl.addEventListener("click", (e) => {
    e.preventDefault();
    navigateHome();
  });
});
homeNav.addEventListener("click", () => {
  navigateHome();
  closeSidebar();
});
strategiesNav.addEventListener("click", () => {
  state.view = "list";
  syncNav();
  render();
  closeSidebar();
});
plannerNav?.addEventListener("click", () => {
  state.view = "planner";
  syncNav();
  render();
  closeSidebar();
});
limitsNav?.addEventListener("click", () => {
  state.view = "limits";
  syncNav();
  render();
  closeSidebar();
});
settingsNav.addEventListener("click", () => {
  state.view = "settings";
  syncNav();
  render();
  closeSidebar();
});
accountButton.addEventListener("click", () => {
  state.view = "settings";
  syncNav();
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
keyboardShortcutsButton?.addEventListener("click", () => {
  closeSidebar();
  openShortcutModal();
});
document.querySelector("#legalModalOverlay")?.addEventListener("click", (event) => {
  if (event.target === document.querySelector("#legalModalOverlay")) closeLegalModal();
});
keyboardShortcutsOverlay?.addEventListener("click", (event) => {
  if (event.target === keyboardShortcutsOverlay) closeShortcutModal();
});
buildModeButton?.addEventListener("click", () => setMode("build"));
askModeButton?.addEventListener("click", () => setMode("ask"));
sidebarBuildModeButton?.addEventListener("click", () => setMode("build"));
sidebarAskModeButton?.addEventListener("click", () => setMode("ask"));
railModeToggleButton?.addEventListener("click", () => setMode(state.mode === "build" ? "ask" : "build"));
function handleKeyboardShortcut(event) {
  if (event.key === "Escape") {
    closeSidebar();
    closeLegalModal();
    closeShortcutModal();
    return;
  }

  if (window.innerWidth <= 767) return;

  const typing = isTypingTarget(event.target);
  const primary = event.metaKey || event.ctrlKey;
  const key = event.code === "KeyN" ? "n" : event.key.toLowerCase();

  if (!typing && (event.key === "?" || (primary && event.key === "/"))) {
    event.preventDefault();
    openShortcutModal();
    return;
  }

  if (typing && primary && event.key === "/") {
    event.preventDefault();
    openShortcutModal();
    return;
  }

  if (!primary || event.isComposing) return;

  // Alt/Option is intentionally allowed for the new-workspace fallback.
  if (event.altKey && key !== "n") return;

  if (event.shiftKey && key === "a") {
    event.preventDefault();
    setMode(state.mode === "build" ? "ask" : "build");
    return;
  }

  const actions = {
    n: () => newStrategyButton?.click(),
    "1": () => homeNav?.click(),
    "2": () => strategiesNav?.click(),
    "3": () => plannerNav?.click(),
    ",": () => settingsNav?.click(),
  };

  if (actions[key]) {
    event.preventDefault();
    actions[key]();
  }
}

// Capture phase gives app shortcuts the earliest possible chance to run.
// Some browsers reserve Meta+N for a new window and may not dispatch it to the page.
window.addEventListener("keydown", handleKeyboardShortcut, true);

// Prevent accidental file drop outside dropzone from navigating away from the app
window.addEventListener("dragover", (e) => {
  if (e.dataTransfer?.types?.includes("Files")) {
    e.preventDefault();
  }
});
window.addEventListener("drop", (e) => {
  if (e.dataTransfer?.types?.includes("Files")) {
    e.preventDefault();
  }
});

function checkSupportBanner() {
  const STORAGE_KEY = "marketify_support_notice_dismissed";
  if (localStorage.getItem(STORAGE_KEY) === "dismissed") return;
  if (document.querySelector("#supportNoticeToast")) return;

  const AUTO_DISMISS_SECONDS = 12;

  const toast = element("aside", "support-notice-toast");
  toast.id = "supportNoticeToast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const header = element("div", "support-notice-header");
  const badge = element("div", "support-notice-badge");
  badge.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
    <span>Texniki dəstək</span>
  `;

  let autoDismissTimer;

  const dismiss = () => {
    clearTimeout(autoDismissTimer);
    toast.classList.add("is-dismissing");
    setTimeout(() => toast.remove(), 260);
  };

  const dismissPermanently = () => {
    localStorage.setItem(STORAGE_KEY, "dismissed");
    dismiss();
  };

  const closeBtn = button("✕", "support-notice-close", dismiss);
  closeBtn.setAttribute("aria-label", "Bağla");
  header.append(badge, closeBtn);

  const title = element(
    "p",
    "support-notice-title",
    "Texniki çətinliklə qarşılaşdığınız halda bizə məlumat verin"
  );

  const body = element(
    "p",
    "support-notice-body",
    "Hər hansı bir xəta, gözlənilməz davranış və ya istifadə zamanı yaranan texniki problem barədə aşağıdakı ünvana yazaraq bizə bildirə bilərsiniz. Komandamız ən qısa zamanda sizə dəstək göstərəcək."
  );

  const emailLink = element("a", "support-notice-email");
  emailLink.href = "mailto:marketifysupport@googlegroups.com";
  emailLink.textContent = "marketifysupport@googlegroups.com";
  emailLink.setAttribute("aria-label", "Dəstək e-poçtu");

  const actions = element("div", "support-notice-actions");
  const dontShowBtn = button("Bir daha göstərmə", "secondary-button support-notice-dontshow-btn", dismissPermanently);
  dontShowBtn.type = "button";

  const mailBtn = button("Mail yaz →", "primary-button support-notice-mail-btn", () => {
    window.location.href = "mailto:marketifysupport@googlegroups.com";
  });
  mailBtn.type = "button";

  actions.append(dontShowBtn, mailBtn);
  toast.append(header, title, body, emailLink, actions);

  // Progress bar for auto-dismiss countdown
  const progressWrap = element("div", "support-notice-progress-wrap");
  const progressBar = element("div", "support-notice-progress-bar");
  progressWrap.appendChild(progressBar);
  toast.appendChild(progressWrap);
  progressBar.style.animationDuration = AUTO_DISMISS_SECONDS + "s";

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
    progressBar.classList.add("is-running");
  });

  autoDismissTimer = setTimeout(dismiss, AUTO_DISMISS_SECONDS * 1000);

  // Pause auto-dismiss on hover
  toast.addEventListener("mouseenter", () => {
    clearTimeout(autoDismissTimer);
    progressBar.style.animationPlayState = "paused";
  });
  toast.addEventListener("mouseleave", () => {
    autoDismissTimer = setTimeout(dismiss, AUTO_DISMISS_SECONDS * 1000);
    progressBar.style.animationPlayState = "running";
  });
}

// Render the workspace immediately while authentication and saved data load in the background.
if (!new Set(["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"]).has(window.location.pathname)) {
  render();
}

initializeAuthentication(async (user) => {
  updateWorkspaceIdentity(user);
  const preferredMode = user?.settings?.defaultMode || (() => {
    try { return localStorage.getItem("marketify_default_mode"); } catch { return null; }
  })();
  if (preferredMode === "ask" || preferredMode === "build") {
    try { localStorage.setItem("marketify_default_mode", preferredMode); } catch {}
    state.mode = preferredMode;
    syncMode();
    syncNav();
  }
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get("mode");
  if (["ask", "build"].includes(requestedMode)) setMode(requestedMode);
  if (params.get("view") === "limits") state.view = "limits";
  render();
  await Promise.allSettled([loadSavedStrategies(), loadSavedChats(), loadPlannerTasks(), loadUsageStats()]);
  resumeBackgroundJobs();
  if (window.location.hash === "#terms" || window.location.pathname === "/terms") {
    openLegalModal("terms");
  } else if (window.location.hash === "#privacy" || window.location.pathname === "/privacy") {
    openLegalModal("privacy");
  }
  checkSupportBanner();
});
