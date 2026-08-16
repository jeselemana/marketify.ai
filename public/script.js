import { createDocumentExport, createSpreadsheetExport } from "./exporters.js";

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
};

let progressTimer;

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
    const safeMessage = ["AI_AUTH_ERROR", "AI_NOT_CONFIGURED", "STRATEGY_ERROR"].includes(data.code)
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
  homeNav.classList.toggle("is-active", state.view !== "list");
  strategiesNav.classList.toggle("is-active", state.view === "list");
  railHomeButton.classList.toggle("is-active", state.view !== "list");
  railStrategiesButton.classList.toggle("is-active", state.view === "list");
}

function resetStrategy() {
  clearInterval(progressTimer);
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
  });
  render();
  closeSidebar();
}

function render() {
  clearInterval(progressTimer);
  syncNav();
  workspace.replaceChildren();
  workspace.className = "workspace";

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
  const eyebrow = element("div", "product-eyebrow");
  eyebrow.append(element("span", "eyebrow-mark", "✦"), document.createTextNode(" MARKETIFY STRATEGY"));
  intro.append(
    eyebrow,
    element("h1", "intake-title", "Növbəti strategiyanı quraq."),
    element(
      "p",
      "intake-description",
      "Məqsədini yaz — Marketify onu aydın qərarlara və icra planına çevirsin.",
    ),
  );

  const form = element("form", "composer-card");
  const label = element("label", "sr-only", "Strategiya brifi");
  label.htmlFor = "briefInput";
  const textarea = element("textarea", "composer-input");
  textarea.id = "briefInput";
  textarea.name = "brief";
  textarea.rows = 2;
  textarea.maxLength = 8000;
  textarea.placeholder = "Biznes məqsədini və ya həll etmək istədiyin problemi yaz…";
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
  const submit = button("Başlat", "primary-button composer-submit");
  submit.type = "submit";
  submit.disabled = state.brief.trim().length < 8;
  submit.appendChild(element("span", "button-arrow", "→"));
  footer.append(composerTools, submit);
  form.append(label, textarea, fileInput, footer);

  textarea.addEventListener("input", () => {
    state.brief = textarea.value;
    submit.disabled = textarea.value.trim().length < 8;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 260)}px`;
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
  setTimeout(() => textarea.focus(), 0);
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
  const view = element("section", "loading-view");
  view.setAttribute("aria-live", "polite");
  const visual = element("div", "loading-visual");
  visual.append(element("span", "loading-orbit"), element("span", "loading-core", "M"));
  const eyebrow = element("div", "loading-eyebrow", isAssessment ? "BRİF ANALİZİ" : "STRATEGİYA HAZIRLANIR");
  const title = element("h1", "loading-title", phases[0][0]);
  const copy = element("p", "loading-copy", phases[0][1]);
  const progress = element("ol", "generation-steps");
  phases.forEach(([phase], index) => {
    const step = element("li", index === 0 ? "is-current" : "is-upcoming");
    step.append(element("span", "generation-step-mark", index === 0 ? "●" : "○"), element("span", "", phase));
    progress.appendChild(step);
  });
  view.append(visual, eyebrow, title, copy, progress);
  workspace.appendChild(view);

  progressTimer = setInterval(() => {
    currentPhase = Math.min(currentPhase + 1, phases.length - 1);
    title.textContent = phases[currentPhase][0];
    copy.textContent = phases[currentPhase][1];
    [...progress.children].forEach((step, index) => {
      step.className = index < currentPhase ? "is-complete" : index === currentPhase ? "is-current" : "is-upcoming";
      step.querySelector(".generation-step-mark").textContent = index < currentPhase ? "✓" : index === currentPhase ? "●" : "○";
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
    if (state.view === "list") renderStrategyList();
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
  state.view = "list";
  render();
  closeSidebar();
});
railNewButton.addEventListener("click", resetStrategy);
sidebarClose.addEventListener("click", closeSidebar);
mobileOverlay.addEventListener("click", closeSidebar);
homeNav.addEventListener("click", resetStrategy);
strategiesNav.addEventListener("click", () => {
  state.view = "list";
  render();
  closeSidebar();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSidebar();
});

render();
loadSavedStrategies();
