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
    ? ["Məqsədi və konteksti anlayıram", "Brifdə kritik boşluqları yoxlayıram"]
    : [
        "Strateji istiqaməti qururam",
        "Prioritetləri sıralayıram",
        "İcra planını hazırlayıram",
        "Ölçü və riskləri dəqiqləşdirirəm",
      ];
  let currentPhase = 0;
  const view = element("section", "loading-view");
  view.setAttribute("aria-live", "polite");
  const visual = element("div", "loading-visual");
  visual.append(element("span", "loading-orbit"), element("span", "loading-core", "M"));
  const eyebrow = element("div", "loading-eyebrow", isAssessment ? "BRİF ANALİZİ" : "STRATEGİYA HAZIRLANIR");
  const title = element("h1", "loading-title", phases[0]);
  const copy = element(
    "p",
    "loading-copy",
    isAssessment
      ? "Yalnız strategiyanı həqiqətən yaxşılaşdıracaq məlumat çatışmırsa sual verəcəyəm."
      : "Brifini strukturlaşdırılmış qərarlara, prioritetlərə və ölçülə bilən fəaliyyət planına çevirirəm.",
  );
  const progress = element("div", "loading-progress");
  phases.forEach((phase, index) => {
    const step = element("span", index === 0 ? "is-active" : "");
    step.title = phase;
    progress.appendChild(step);
  });
  view.append(visual, eyebrow, title, copy, progress);
  workspace.appendChild(view);

  progressTimer = setInterval(() => {
    currentPhase = Math.min(currentPhase + 1, phases.length - 1);
    title.textContent = phases[currentPhase];
    [...progress.children].forEach((step, index) => step.classList.toggle("is-active", index <= currentPhase));
    if (currentPhase === phases.length - 1) clearInterval(progressTimer);
  }, 1800);
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
  const view = element("section", "clarification-view");
  view.setAttribute("aria-labelledby", "clarificationTitle");
  const top = element("div", "clarification-heading");
  top.append(
    element("div", "step-label", `QISA DƏQİQLƏŞDİRMƏ · ${state.round + 1}/2`),
    element("h1", "clarification-title", `Strategiyanı daha dəqiq qurmaq üçün ${state.questions.length} detal lazımdır.`),
    element("p", "clarification-copy", state.understanding),
  );

  const form = element("form", "clarification-form");
  state.questions.forEach((question, index) => {
    const fieldset = element("fieldset", "question-card");
    const legend = element("legend", "question-title");
    legend.append(element("span", "question-number", String(index + 1)), document.createTextNode(question.question));
    fieldset.appendChild(legend);
    if (question.reason) fieldset.appendChild(element("p", "question-reason", question.reason));

    if (question.inputType === "text" || !question.options.length) {
      const input = element("textarea", "question-input");
      input.name = question.id;
      input.rows = 2;
      input.maxLength = 1500;
      input.placeholder = "Qısa cavab yaz…";
      input.required = true;
      fieldset.appendChild(input);
    } else {
      const options = element("div", "choice-grid");
      question.options.forEach((option, optionIndex) => {
        const label = element("label", "choice-pill");
        const input = document.createElement("input");
        input.type = question.inputType === "multi_choice" ? "checkbox" : "radio";
        input.name = question.id;
        input.value = option;
        input.required = question.inputType === "single_choice" && optionIndex === 0;
        label.append(input, element("span", "", option));
        options.appendChild(label);
      });
      fieldset.appendChild(options);
    }
    form.appendChild(fieldset);
  });

  const actions = element("div", "clarification-actions");
  const skip = button("Dəqiq bilmirəm — fərziyyə ilə davam et", "text-button", () => {
    state.assumptions = [
      ...state.assumptions,
      "İstifadəçi əlavə dəqiqləşdirmə vermədən işçi fərziyyələrlə davam etməyi seçdi.",
    ];
    startGeneration();
  });
  const continueButton = button("Davam et", "primary-button");
  continueButton.type = "submit";
  continueButton.appendChild(element("span", "button-arrow", "→"));
  actions.append(skip, continueButton);
  form.appendChild(actions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const newAnswers = state.questions.map((question) => ({
      questionId: question.id,
      question: question.question,
      answer: formData.getAll(question.id).join(", ").trim(),
    }));
    if (newAnswers.some((answer) => !answer.answer)) {
      showToast("Bütün suallara qısa cavab ver.", "error");
      return;
    }
    state.answers = [...state.answers, ...newAnswers];
    state.round += 1;
    trackEvent("clarification_completed", { answerCount: newAnswers.length, round: state.round });
    startAssessment();
  });

  const banner = errorBanner();
  if (banner) view.appendChild(banner);
  view.append(top, form);
  workspace.appendChild(view);
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
  const crumb = button("← Strategiyalar", "text-button toolbar-back", () => {
    state.view = "list";
    render();
  });
  const toolbarActions = element("div", "toolbar-actions");
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
  const saveButton = button(state.savedId ? "Yadda saxlanıb" : "Strategiyanı yadda saxla", "primary-button compact", saveStrategy);
  saveButton.disabled = Boolean(state.savedId) || state.status === "refining";
  toolbarActions.append(exportWrap, saveButton);
  toolbar.append(crumb, toolbarActions);

  const header = element("header", "strategy-header");
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
  header.append(meta, title, element("p", "strategy-lede", strategy.summary));
  if (state.changeSummary) header.append(element("div", "change-note", state.changeSummary));

  const context = element("section", "strategy-block context-block");
  context.appendChild(createSectionHeading("KONTEKST", "Strategiyanın əsası"));
  const contextGrid = element("dl", "context-grid");
  [
    ["Biznes", strategy.context.business],
    ["Məqsəd", strategy.context.objective],
    ["Bazar", strategy.context.market],
    ["Auditoriya", strategy.context.targetAudience],
  ].forEach(([label, value]) => {
    const item = element("div", "context-item");
    item.append(element("dt", "", label), element("dd", "", value));
    contextGrid.appendChild(item);
  });
  context.appendChild(contextGrid);

  const priorities = element("section", "strategy-block");
  priorities.appendChild(
    createSectionHeading("PRİORİTETLƏR", "Əvvəl nə vacibdir", "Resurs və diqqətin ilk yönələcəyi qərarlar."),
  );
  const priorityGrid = element("div", "priority-grid");
  strategy.priorities.forEach((priority, index) => {
    const card = element("article", "priority-card");
    const number = element("span", "priority-number", String(index + 1).padStart(2, "0"));
    const level = element("span", `priority-level priority-${priority.priority}`, priority.priority);
    const top = element("div", "priority-top");
    top.append(number, level);
    card.append(top, element("h3", "", priority.title), element("p", "", priority.description));
    priorityGrid.appendChild(card);
  });
  priorities.appendChild(priorityGrid);

  const direction = element("section", "strategy-block");
  direction.appendChild(createSectionHeading("STRATEJİ İSTİQAMƏT", "Qərarlar və yanaşma"));
  const sections = element("div", "strategy-sections");
  strategy.sections.forEach((section, index) => {
    const article = element("article", "strategy-section");
    const indexNode = element("span", "section-index", String(index + 1).padStart(2, "0"));
    const copy = element("div", "section-copy");
    copy.append(element("h3", "", section.title));
    if (section.summary) copy.append(element("p", "section-summary", section.summary));
    copy.append(element("p", "section-content", section.content));
    if (section.bullets.length) {
      const list = element("ul", "decision-list");
      section.bullets.forEach((item) => list.appendChild(element("li", "", item)));
      copy.appendChild(list);
    }
    article.append(indexNode, copy);
    sections.appendChild(article);
  });
  direction.appendChild(sections);

  const actionPlan = element("section", "strategy-block");
  actionPlan.appendChild(
    createSectionHeading("İCRA PLANI", "Strategiyadan hərəkətə", "Fazalar üzrə konkret işlər və gözlənilən nəticə."),
  );
  const timeline = element("div", "timeline");
  strategy.actionPlan.forEach((phase, index) => {
    const row = element("article", "timeline-row");
    const rail = element("div", "timeline-rail");
    rail.append(element("span", "timeline-dot", String(index + 1)), element("span", "timeline-line"));
    const body = element("div", "timeline-body");
    body.append(element("h3", "", phase.phase));
    const list = element("ul", "decision-list compact-list");
    phase.actions.forEach((action) => list.appendChild(element("li", "", action)));
    body.appendChild(list);
    if (phase.expectedOutcome) {
      const outcome = element("p", "expected-outcome");
      outcome.append(element("strong", "", "Gözlənilən nəticə: "), document.createTextNode(phase.expectedOutcome));
      body.appendChild(outcome);
    }
    row.append(rail, body);
    timeline.appendChild(row);
  });
  actionPlan.appendChild(timeline);

  const measurement = element("section", "strategy-block");
  measurement.appendChild(createSectionHeading("ÖLÇÜ", "KPI-lar və uğur siqnalları"));
  const kpiGrid = element("div", "kpi-grid");
  strategy.kpis.forEach((kpi) => {
    const card = element("article", "kpi-card");
    card.append(element("h3", "", kpi.name), element("p", "", kpi.reason));
    if (kpi.target) card.append(element("span", "kpi-target", kpi.target));
    kpiGrid.appendChild(card);
  });
  measurement.appendChild(kpiGrid);

  if (strategy.risks.length) {
    const risks = element("section", "strategy-block");
    risks.appendChild(createSectionHeading("RİSKLƏR", "Nə planı poza bilər"));
    const riskList = element("div", "risk-list");
    strategy.risks.forEach((risk) => {
      const row = element("article", "risk-row");
      const riskCopy = element("div");
      riskCopy.append(element("span", "risk-label", "RİSK"), element("p", "", risk.risk));
      const mitigation = element("div");
      mitigation.append(element("span", "risk-label", "QARŞILIĞI"), element("p", "", risk.mitigation));
      row.append(riskCopy, mitigation);
      riskList.appendChild(row);
    });
    risks.appendChild(riskList);
    view.append(toolbar, header, context, priorities, direction, actionPlan, measurement, risks);
  } else {
    view.append(toolbar, header, context, priorities, direction, actionPlan, measurement);
  }

  const closeout = element("section", "strategy-block closeout-grid");
  const assumptions = element("div", "closeout-card");
  assumptions.append(element("span", "section-kicker", "FƏRZİYYƏLƏR"), element("h2", "", "Nəyə əsaslanırıq"));
  const assumptionList = element("ul", "decision-list");
  strategy.assumptions.forEach((item) => assumptionList.appendChild(element("li", "", item)));
  assumptions.appendChild(assumptionList);
  const next = element("div", "closeout-card next-card");
  next.append(element("span", "section-kicker", "NÖVBƏTİ ADDIMLAR"), element("h2", "", "İndi nə etməli"));
  const nextList = element("ol", "next-list");
  strategy.nextSteps.forEach((item) => nextList.appendChild(element("li", "", item)));
  next.appendChild(nextList);
  closeout.append(assumptions, next);
  view.append(closeout, buildRefinementPanel());

  if (state.status === "refining") {
    const working = element("div", "refining-banner");
    working.append(element("span", "inline-spinner"), element("span", "", "Strategiya yenilənir — mövcud versiya ekranda qalır."));
    view.prepend(working);
  }
  const banner = errorBanner();
  if (banner) view.insertBefore(banner, header);
  workspace.appendChild(view);
}

function buildRefinementPanel() {
  const panel = element("section", "refinement-panel");
  panel.setAttribute("aria-labelledby", "refineTitle");
  panel.append(
    element("span", "section-kicker", "BİRLİKDƏ YENİLƏYƏK"),
    element("h2", "", "Dəyişiklik istə"),
    element("p", "refinement-copy", "Mövcud strategiyanı saxlayaraq büdcə, auditoriya, kanal və ya yanaşmanı dəyiş."),
  );
  const form = element("form", "refinement-form");
  const label = element("label", "sr-only", "Dəyişiklik istəyi");
  label.htmlFor = "refinementInput";
  const input = element("textarea", "refinement-input");
  input.id = "refinementInput";
  input.rows = 2;
  input.maxLength = 2000;
  input.placeholder = "Məsələn: Büdcəni 700 AZN-ə endir və universitet tələbələrinə fokuslan…";
  input.disabled = state.status === "refining";
  const submit = button("Göndər", "refine-submit");
  submit.type = "submit";
  submit.disabled = true;
  submit.setAttribute("aria-label", "Dəyişiklik istəyini göndər");
  submit.append(element("span", "", "↑"));
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

  const quick = element("div", "quick-actions");
  QUICK_ACTIONS.forEach(([action, label]) => {
    const actionButton = button(label, "quick-action", () => requestRefinement(action, ""));
    actionButton.disabled = state.status === "refining";
    quick.appendChild(actionButton);
  });
  panel.appendChild(quick);
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
  const title = element("span", "export-label", "İXRAC ET");
  menu.appendChild(title);
  const doc = button("Sənəd (.html)", "export-option", () => {
    trackEvent("export_requested", { format: "document" });
    downloadExport(createDocumentExport(state.strategy));
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  });
  const csv = button("Cədvəl (.csv)", "export-option", () => {
    trackEvent("export_requested", { format: "spreadsheet" });
    downloadExport(createSpreadsheetExport(state.strategy));
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  });
  menu.append(doc, csv, element("div", "export-separator"));
  ["Google Docs", "Google Sheets", "Excel inteqrasiyası"].forEach((label) => {
    const option = button(label, "export-option is-coming", () => {
      trackEvent("export_requested", { format: label, available: false });
      showToast(`${label} bağlantısı tezliklə əlavə olunacaq. Hazırda lokal export istifadə edə bilərsən.`, "neutral");
    });
    option.append(element("span", "coming-badge", "Tezliklə"));
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
  copy.append(element("span", "section-kicker", "WORKSPACE"), element("h1", "", "Strategiyalar"), element("p", "", "Yadda saxladığın işləri aç, davam etdir və export et."));
  heading.append(copy, button("＋ Yeni strategiya", "primary-button", resetStrategy));
  view.appendChild(heading);

  if (!state.savedStrategies.length) {
    const empty = element("div", "empty-state");
    empty.append(
      element("span", "empty-icon", "✦"),
      element("h2", "", "Hələ strategiya yoxdur"),
      element("p", "", "İlk AI strategiyanı qur və sonra workspace-ə əlavə et."),
      button("Yeni strategiya", "primary-button", resetStrategy),
    );
    view.appendChild(empty);
  } else {
    const grid = element("div", "saved-grid");
    state.savedStrategies.forEach((record) => {
      const card = element("article", "saved-card");
      const top = element("div", "saved-card-top");
      top.append(element("span", "saved-status", "Yadda saxlanıb"), element("span", "saved-version", `${record.versionCount} versiya`));
      card.append(
        top,
        element("h2", "", record.title),
        element("p", "", record.strategy?.summary || record.brief),
      );
      const footer = element("div", "saved-card-footer");
      footer.append(element("span", "", formatDate(record.updatedAt)), button("Aç →", "text-button", () => openSavedStrategy(record.id)));
      card.appendChild(footer);
      grid.appendChild(card);
    });
    view.appendChild(grid);
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
