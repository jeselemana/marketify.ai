import { createDocumentExport, createSpreadsheetExport } from "./exporters.js";
import { authRequest, initializeAuthentication, logout } from "./auth.js";

const workspace = document.querySelector("#workspace");
const sidebar = document.querySelector("#sidebar");
const mobileOverlay = document.querySelector("#mobileOverlay");
const mobileMenuButton = document.querySelector("#mobileMenuButton");
const railMenuButton = document.querySelector("#railMenuButton");
const railHomeButton = document.querySelector("#railHomeButton");
const railStrategiesButton = document.querySelector("#railStrategiesButton");
const railNewButton = document.querySelector("#railNewButton");
const sidebarClose = document.querySelector("#sidebarClose");
const toastRegion = document.querySelector("#toastRegion");
const recentList = document.querySelector("#recentList");
const strategyCount = document.querySelector("#strategyCount");
const homeNav = document.querySelector("#homeNav");
const strategiesNav = document.querySelector("#strategiesNav");
const settingsNav = document.querySelector("#settingsNav");
const accountButton = document.querySelector("#accountButton");
const workspaceAvatar = document.querySelector("#workspaceAvatar");
const workspaceName = document.querySelector("#workspaceName");
const workspaceMeta = document.querySelector("#workspaceMeta");
const buildModeButton = document.querySelector("#buildModeButton");
const askModeButton = document.querySelector("#askModeButton");

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
  askMessages: [],
  askLoading: false,
  askError: "",
  askStrategyId: "",
  currentUser: null,
  settingsTab: "account",
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
  return new Intl.DateTimeFormat("az-AZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
      "Təəssüf ki, hazırda qeydiyyat prosesində texniki çətinlik müşahidə olunur, müvəqqəti olaraq üçüncü tərəf qeydiyyat vasitəsilə davam edə bilərsiniz. Komandamız problemi ən qısa zaman ərzində aradan qaldıracaq.",
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
  homeNav.classList.toggle("is-active", isBuild && !["list", "settings"].includes(state.view));
  strategiesNav.classList.toggle("is-active", isBuild && state.view === "list");
  settingsNav.classList.toggle("is-active", state.view === "settings");
  railHomeButton.classList.toggle("is-active", isBuild && !["list", "settings"].includes(state.view));
  railStrategiesButton.classList.toggle("is-active", isBuild && state.view === "list");
}

function syncMode() {
  const isBuild = state.mode === "build";
  buildModeButton.classList.toggle("is-active", isBuild);
  askModeButton.classList.toggle("is-active", !isBuild);
  buildModeButton.setAttribute("aria-selected", String(isBuild));
  askModeButton.setAttribute("aria-selected", String(!isBuild));
  document.body.dataset.mode = state.mode;
}

function setMode(mode) {
  if (!['build', 'ask'].includes(mode) || state.mode === mode) return;
  state.mode = mode;
  syncMode();
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
  if (state.mode === "ask") return renderAsk();
  if (state.view === "list") return renderStrategyList();
  if (["analyzing", "generating"].includes(state.status)) return renderLoading();
  if (state.status === "needs_clarification") return renderClarification();
  if (state.strategy) return renderStrategyWorkspace();
  return renderIntake();
}

function renderIntake() {
  workspace.classList.add("workspace-centered");

  const view = element("section", "intake-view");
  view.setAttribute("aria-labelledby", "intakeTitle");

  const intro = element("div", "intake-intro");

  intro.append(
    element("h1", "intake-title", "Növbəti strategiyanı quraq."),
   
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
  const selectedStrategy = state.savedStrategies.find((strategy) => strategy.id === state.askStrategyId) || null;
  const shell = element("section", `ask-shell${state.askMessages.length ? " has-messages" : " is-empty"}`);
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
        const copy = button("", "ask-response-action", () => copyAskResponse(message.content));
        copy.setAttribute("aria-label", "Cavabı kopyala");
        copy.title = "Kopyala";
        copy.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>Kopyala</span>';
        const share = button("", "ask-response-action", () => shareAskResponse(message.content));
        share.setAttribute("aria-label", "Cavabı paylaş");
        share.title = "Paylaş";
        share.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg><span>Paylaş</span>';
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
      body: JSON.stringify({ messages: state.askMessages, strategyId: state.askStrategyId || undefined }),
    });
    const response = { role: "assistant", content: data.reply };
    freshAskResponses.add(response);
    state.askMessages.push(response);
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

function createSectionHeading(kicker, title, description) {
  const heading = element("div", "section-heading");
  heading.append(element("span", "section-kicker", kicker), element("h2", "", title));
  if (description) heading.append(element("p", "", description));
  return heading;
}

function renderStrategyWorkspace() {
  workspace.classList.add("workspace-document");
  const strategy = state.strategy;
  const view = element("div", `strategy-view${state.status === "refining" ? " is-refining" : ""}`);

  const toolbar = element("div", "strategy-toolbar");
  const crumb = button(`Strategiyalar / ${strategy.title}`, "strategy-breadcrumb", () => {
    state.view = "list";
    render();
  });
  const toolbarActions = element("div", "toolbar-actions");
  const refineButton = button("Dəyişiklik istə", "secondary-button compact", () => document.querySelector("#refinementInput")?.focus());
  const exportWrap = element("div", "export-wrap");
  const exportButton = button("İxrac", "secondary-button compact");
  exportButton.setAttribute("aria-haspopup", "menu");
  exportButton.setAttribute("aria-expanded", "false");
  const menu = buildExportMenu(exportButton);
  exportButton.addEventListener("click", () => {
    const open = menu.classList.toggle("is-open");
    exportButton.setAttribute("aria-expanded", String(open));
  });
  exportWrap.append(exportButton, menu);
  const saveButton = button(state.savedId ? "Yadda saxlanıb" : "Yadda saxla", "primary-button compact", saveStrategy);
  saveButton.disabled = Boolean(state.savedId) || state.status === "refining";
  toolbarActions.append(refineButton, exportWrap, saveButton);
  toolbar.append(crumb, toolbarActions);

  const header = element("header", "strategy-overview");
  header.id = "overview";
  const status = element("span", `status-badge status-${state.status}`);
  status.append(element("span", "status-dot"), document.createTextNode(STATUS_LABELS[state.status]));
  const title = element("h1", "strategy-title", strategy.title);
  const meta = element("div", "strategy-meta");
  meta.append(
    status,
    element("span", "meta-divider", "·"),
    element("span", "", `Versiya ${state.versions.length}`),
    element("span", "meta-divider", "·"),
    element("span", "", `Yenilənib ${formatDate(state.updatedAt)}`),
  );
  const thesis = element("p", "strategy-lede", firstSentences(strategy.summary, 2));
  header.append(meta, title, thesis);
  if (state.changeSummary) header.append(element("div", "change-note", state.changeSummary));

  const metrics = element("dl", "overview-metrics");
  [
    [shortValue(strategy.actionPlan[0]?.phase || "Planlı"), "İlk mərhələ"],
    [budgetSignal(state.brief), "Marketinq büdcəsi"],
    [shortValue(strategy.priorities[0]?.title || "Fokuslu"), "Əsas prioritet"],
    [shortValue(strategy.context.targetAudience), "Əsas auditoriya"],
  ].forEach(([value, label]) => {
    const item = element("div", "overview-metric");
    item.append(element("dd", "", value), element("dt", "", label));
    metrics.appendChild(item);
  });
  header.appendChild(metrics);
  const essence = element("div", "strategy-essence");
  essence.append(element("h2", "", "Strategiyanın mahiyyəti"), element("p", "", firstSentences(strategy.summary, 3)));
  header.appendChild(essence);

  const priorities = element("section", "strategy-work-section");
  priorities.id = "priorities";
  priorities.appendChild(createSectionHeading("PRİORİTETLƏR", "Əvvəl nə vacibdir"));
  const priorityGrid = element("div", "priority-rows");
  strategy.priorities.forEach((priority, index) => {
    const card = element("article", "priority-row");
    const level = element("span", `priority-level priority-${priority.priority}`, priority.priority);
    const copy = element("div", "priority-row-copy");
    copy.append(element("h3", "", `${String(index + 1).padStart(2, "0")}  ${priority.title}`), element("p", "", firstSentences(priority.description, 1)));
    card.append(copy, level);
    priorityGrid.appendChild(card);
  });
  priorities.appendChild(priorityGrid);

  const direction = element("section", "strategy-work-section");
  direction.id = "strategy";
  direction.appendChild(createSectionHeading("STRATEGİYA", "Qərarlar və yanaşma"));
  const sections = element("div", "strategy-sections");
  strategy.sections.forEach((section, index) => {
    const article = element("article", "decision-section");
    article.append(element("h3", "", `${String(index + 1).padStart(2, "0")} — ${section.title}`));
    const decision = element("div", "decision-field");
    decision.append(element("strong", "", "Qərar"), element("p", "", section.summary || firstSentences(section.content, 1)));
    const rationale = element("div", "decision-field");
    rationale.append(element("strong", "", "Niyə"), element("p", "", firstSentences(section.content, 3)));
    article.append(decision, rationale);
    if (section.bullets.length) {
      const actions = element("div", "decision-field");
      actions.append(element("strong", "", "Et"));
      const list = element("ul", "decision-list");
      section.bullets.forEach((item) => list.appendChild(element("li", "", item)));
      actions.appendChild(list);
      article.appendChild(actions);
    }
    sections.appendChild(article);
  });
  direction.appendChild(sections);

  const actionPlan = element("section", "strategy-work-section");
  actionPlan.id = "execution";
  actionPlan.appendChild(createSectionHeading("İCRA PLANI", "Strategiyadan hərəkətə"));
  const timeline = element("div", "timeline");
  strategy.actionPlan.forEach((phase, index) => {
    const row = element("article", "timeline-row");
    const rail = element("div", "timeline-rail");
    rail.append(element("span", "timeline-dot", String(index + 1)), element("span", "timeline-line"));
    const body = element("div", "timeline-body");
    body.append(element("h3", "", phase.phase));
    const list = element("ul", "decision-list compact-list");
    phase.actions.slice(0, 3).forEach((action) => list.appendChild(element("li", "", action)));
    body.appendChild(list);
    if (phase.actions.length > 3) {
      const details = document.createElement("details");
      details.className = "timeline-details";
      details.appendChild(element("summary", "", "Detalları göstər"));
      const extra = element("ul", "decision-list compact-list");
      phase.actions.slice(3).forEach((action) => extra.appendChild(element("li", "", action)));
      details.appendChild(extra);
      body.appendChild(details);
    }
    if (phase.expectedOutcome) {
      const outcome = element("p", "expected-outcome");
      outcome.append(element("strong", "", "Gözlənilən nəticə: "), document.createTextNode(phase.expectedOutcome));
      body.appendChild(outcome);
    }
    row.append(rail, body);
    timeline.appendChild(row);
  });
  actionPlan.appendChild(timeline);

  const measurement = element("section", "strategy-work-section");
  measurement.id = "kpi";
  measurement.appendChild(createSectionHeading("KPI", "Ölçü və uğur siqnalları"));
  const kpiGrid = element("div", "kpi-table");
  const kpiHead = element("div", "kpi-row kpi-head");
  kpiHead.append(element("span", "", "KPI"), element("span", "", "Nəyi göstərir"), element("span", "", "İlk siqnal"));
  kpiGrid.appendChild(kpiHead);
  strategy.kpis.forEach((kpi) => {
    const row = element("details", "kpi-row");
    const summary = element("summary", "kpi-summary");
    summary.append(element("strong", "", kpi.name), element("span", "", firstSentences(kpi.reason, 1)), element("span", "kpi-signal", kpi.target || "İlk ölçüm dövrü"));
    row.append(summary, element("p", "kpi-detail", kpi.reason));
    kpiGrid.appendChild(row);
  });
  measurement.appendChild(kpiGrid);

  const risks = element("section", "strategy-work-section");
  risks.id = "risks";
  risks.appendChild(createSectionHeading("RİSKLƏR", "Nə planı poza bilər"));
  const riskList = element("div", "risk-table");
  if (strategy.risks.length) {
    strategy.risks.forEach((risk, index) => {
      const row = element("article", "risk-compact-row");
      const riskCopy = element("div", "risk-main");
      riskCopy.append(element("span", "risk-severity", index < 2 ? "HIGH" : "MEDIUM"), element("strong", "", risk.risk));
      row.append(riskCopy, element("p", "", risk.mitigation));
      riskList.appendChild(row);
    });
  } else {
    riskList.appendChild(element("p", "section-empty", "Əlavə kritik risk müəyyən edilməyib."));
  }
  risks.appendChild(riskList);

  const closeout = element("section", "strategy-work-section next-actions-section");
  closeout.id = "next";
  closeout.appendChild(createSectionHeading("NÖVBƏTİ ADDIMLAR", "İndi nə etməli"));
  const checklist = element("div", "action-checklist");
  const groupLabels = ["Bu gün", "Növbəti 48 saat", "Bu həftə"];
  const chunkSize = Math.max(1, Math.ceil(strategy.nextSteps.length / 3));
  groupLabels.forEach((label, groupIndex) => {
    const items = strategy.nextSteps.slice(groupIndex * chunkSize, (groupIndex + 1) * chunkSize);
    if (!items.length) return;
    const group = element("section", "checklist-group");
    group.appendChild(element("h3", "", label));
    items.forEach((item, itemIndex) => {
      const checkboxLabel = element("label", "checklist-item");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.key = `${groupIndex}-${itemIndex}`;
      checkboxLabel.append(checkbox, element("span", "", item));
      group.appendChild(checkboxLabel);
    });
    checklist.appendChild(group);
  });
  closeout.appendChild(checklist);

  const assumptions = document.createElement("details");
  assumptions.className = "assumptions-panel";
  assumptions.appendChild(element("summary", "", "Fərziyyələr və əsas kontekst"));
  const assumptionList = element("ul", "decision-list");
  strategy.assumptions.forEach((item) => assumptionList.appendChild(element("li", "", item)));
  assumptions.append(assumptionList);

  const tocItems = [
    ["overview", "Ümumi baxış"], ["priorities", "Prioritetlər"], ["strategy", "Strategiya"],
    ["execution", "İcra planı"], ["kpi", "KPI"], ["risks", "Risklər"], ["next", "Növbəti addımlar"],
  ];
  const toc = element("nav", "strategy-toc");
  toc.setAttribute("aria-label", "Strategiya bölmələri");
  tocItems.forEach(([id, label], index) => {
    const link = element("a", index === 0 ? "is-active" : "", label);
    link.href = `#${id}`;
    toc.appendChild(link);
  });
  const documentCanvas = element("main", "strategy-document-canvas");
  documentCanvas.append(header, priorities, direction, actionPlan, measurement, risks, closeout, assumptions);
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
  panel.setAttribute("aria-label", "Strategiyanı yenilə");
  const quick = element("div", "quick-actions");
  QUICK_ACTIONS.forEach(([action, label]) => {
    const actionButton = button(label, "quick-action", () => requestRefinement(action, ""));
    actionButton.disabled = state.status === "refining";
    quick.appendChild(actionButton);
  });
  panel.appendChild(quick);
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
  submit.append(element("span", "", "→"));
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
  panel.appendChild(form);
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
  const doc = button("HTML sənədi", "export-option", () => {
    trackEvent("export_requested", { format: "document" });
    downloadExport(createDocumentExport(state.strategy));
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  });
  const csv = button("CSV / məlumat", "export-option", () => {
    trackEvent("export_requested", { format: "spreadsheet" });
    downloadExport(createSpreadsheetExport(state.strategy));
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  });
  menu.append(doc, csv, element("div", "export-separator"), element("span", "export-label", "İnteqrasiyalar"));
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

function renderRecentList() {
  recentList.replaceChildren();
  if (!state.savedStrategies.length) {
    const empty = element("div", "recent-empty");
    empty.append(element("strong", "", "Strategiyalar burada görünəcək."), element("span", "", "Yadda saxladığın işlər bu bölmədə qalır."));
    recentList.appendChild(empty);
    return;
  }
  state.savedStrategies.slice(0, 5).forEach((record) => {
    const item = button("", "recent-item", () => openSavedStrategy(record.id));
    item.classList.toggle("is-active", state.savedId === record.id);
    item.append(element("span", "recent-title", record.title), element("span", "recent-date", formatDate(record.updatedAt)));
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
  tabs.append(accountTab, securityTab);
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
  } else {
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
  }
  workspace.appendChild(view);
}

function renderStrategyList() {
  workspace.classList.add("workspace-list");
  workspace.replaceChildren();
  const view = element("section", "strategies-view");
  const heading = element("div", "list-heading");
  const copy = element("div");
  copy.append(element("span", "section-kicker", "WORKSPACE"), element("h1", "", "Strategiyalar"), element("p", "", "Yadda saxladığın strategiyaları tap, aç və davam etdir."));
  heading.append(copy, button("＋ Yeni strategiya", "primary-button", resetStrategy));
  view.appendChild(heading);

  if (!state.savedStrategies.length) {
    const empty = element("div", "empty-state");
    empty.append(
      element("span", "empty-icon", "✦"),
      element("h2", "", "Strategiyalar burada görünəcək"),
      element("p", "", "İlk strategiyanı qur və yadda saxla."),
      button("Yeni strategiya", "primary-button", resetStrategy),
    );
    view.appendChild(empty);
  } else {
    const controls = element("div", "library-controls");
    const search = element("input", "library-search");
    search.type = "search";
    search.placeholder = "Strategiyalarda axtar";
    search.setAttribute("aria-label", "Strategiyalarda axtar");
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

document.querySelector("#newStrategyButton").addEventListener("click", resetStrategy);
document.querySelector("#mobileNewButton").addEventListener("click", resetStrategy);
mobileMenuButton.addEventListener("click", openSidebar);
railMenuButton.addEventListener("click", () => (sidebar.classList.contains("is-open") ? closeSidebar() : openSidebar()));
railHomeButton.addEventListener("click", resetStrategy);
railStrategiesButton.addEventListener("click", () => {
  state.mode = "build";
  state.view = "list";
  render();
  closeSidebar();
});
railNewButton.addEventListener("click", resetStrategy);
sidebarClose.addEventListener("click", closeSidebar);
mobileOverlay.addEventListener("click", closeSidebar);
homeNav.addEventListener("click", resetStrategy);
strategiesNav.addEventListener("click", () => {
  state.mode = "build";
  state.view = "list";
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
buildModeButton.addEventListener("click", () => setMode("build"));
askModeButton.addEventListener("click", () => setMode("ask"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSidebar();
});

initializeAuthentication(async (user) => {
  updateWorkspaceIdentity(user);
  render();
  showRegistrationNotice();
  await loadSavedStrategies();
});
