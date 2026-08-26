async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function formatDate(ts) {
  if (!ts) return "–";
  const d = new Date(ts);
  return d.toLocaleString("az-AZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

// -------------------------------------------------------------
// 🗂️ TAB NAVIGATION
// -------------------------------------------------------------
function setupTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  const contents = {
    legal: document.getElementById("tabContentLegal"),
    brain: document.getElementById("tabContentBrain"),
    logs: document.getElementById("tabContentLogs"),
    learning: document.getElementById("tabContentLearning"),
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");

      const target = tab.dataset.tab;
      Object.entries(contents).forEach(([key, contentEl]) => {
        if (!contentEl) return;
        if (key === target) {
          contentEl.style.display = "block";
          contentEl.classList.add("is-active");
        } else {
          contentEl.style.display = "none";
          contentEl.classList.remove("is-active");
        }
      });

      if (target === "legal") loadLegalReports();
      if (target === "brain") { loadStats(); loadTemplates(); }
      if (target === "logs") loadLogs();
      if (target === "learning") loadAiLearning();
    });
  });
}

// -------------------------------------------------------------
// ✦ AI LEARNING
// -------------------------------------------------------------
const learningState = { interactionPage: 1, candidatePage: 1, loaded: false };

function percent(value) {
  return `${((Number(value) || 0) * 100).toFixed(1)}%`;
}

function formatMoney(value, unknown = false) {
  if (unknown) return "Pricing yoxdur";
  return `$${(Number(value) || 0).toFixed(4)}`;
}

function learningQuery(extra = {}) {
  const params = new URLSearchParams();
  const range = document.getElementById("learningRange")?.value || "7d";
  const now = new Date();
  if (range !== "all") {
    const from = new Date(now);
    if (range === "today") from.setHours(0, 0, 0, 0);
    else from.setDate(from.getDate() - (range === "30d" ? 30 : 7));
    params.set("from", from.toISOString());
  }
  [["mode", "learningMode"], ["provider", "learningProvider"], ["model", "learningModel"], ["taskType", "learningTask"], ["candidateStatus", "learningCandidateStatus"], ["minQuality", "learningMinQuality"], ["maxQuality", "learningMaxQuality"]].forEach(([key, id]) => {
    const value = document.getElementById(id)?.value;
    if (value && value !== "all") params.set(key, value);
  });
  Object.entries(extra).forEach(([key, value]) => params.set(key, value));
  return params.toString();
}

function renderLearningKpis(data) {
  const root = document.getElementById("learningKpis");
  const entries = [
    ["Total AI Interactions", data.totalInteractions], ["Ask Interactions", data.askInteractions],
    ["Build Interactions", data.buildInteractions], ["Training Candidates", data.trainingCandidates],
    ["Approved Samples", data.approvedSamples], ["Pending Review", data.pendingCandidates],
    ["Rejected", data.rejectedCandidates],
  ];
  root.innerHTML = entries.map(([label, value], index) => `<div class="stat ${index === 4 ? "stat-success" : index === 5 ? "stat-warning" : ""}"><span class="label">${escapeHtml(label)}</span><span class="value">${Number(value) || 0}</span></div>`).join("");
  document.getElementById("badgePendingLearning").textContent = data.pendingCandidates || 0;
  document.getElementById("learningCost").innerHTML = `<div class="cost-number">${formatMoney(data.totalEstimatedCost)}</div><div class="cost-breakdown"><span>Ask <strong>${formatMoney(data.askEstimatedCost)}</strong></span><span>Build <strong>${formatMoney(data.buildEstimatedCost)}</strong></span><span>Avg / priced request <strong>${data.averageEstimatedCost === null ? "–" : formatMoney(data.averageEstimatedCost)}</strong></span><span>Input / output tokens <strong>${Number(data.inputTokens).toLocaleString()} / ${Number(data.outputTokens).toLocaleString()}</strong></span></div><p>${data.unpricedInteractions ? `${data.unpricedInteractions} interaction üçün pricing config yoxdur; cost uydurulmayıb.` : "Bütün interaction-lar historical pricing snapshot ilə hesablanıb."}</p>`;
}

function renderGrowth(points) {
  const root = document.getElementById("learningGrowth");
  if (!points.length) { root.innerHTML = '<div class="empty-state">Seçilən period üçün data yoxdur.</div>'; return; }
  const visible = points.slice(-30);
  const max = Math.max(1, ...visible.flatMap((point) => [point.rawInteractions, point.trainingCandidates, point.approvedSamples]));
  root.innerHTML = `<div class="growth-legend"><span><i class="raw"></i>Raw</span><span><i class="candidate"></i>Candidate</span><span><i class="approved"></i>Approved</span></div><div class="growth-bars">${visible.map((point) => `<div class="growth-day" title="${escapeHtml(point.date)} · Raw ${point.rawInteractions} · Candidate ${point.trainingCandidates} · Approved ${point.approvedSamples}"><div class="growth-columns"><i class="raw" style="height:${Math.max(2, point.rawInteractions / max * 100)}%"></i><i class="candidate" style="height:${Math.max(2, point.trainingCandidates / max * 100)}%"></i><i class="approved" style="height:${Math.max(2, point.approvedSamples / max * 100)}%"></i></div><small>${escapeHtml(point.date.slice(5))}</small></div>`).join("")}</div>`;
}

function populateLearningSelect(id, values) {
  const select = document.getElementById(id);
  const current = select.value;
  const base = select.options[0].outerHTML;
  select.innerHTML = base + [...new Set(values.filter(Boolean))].sort().map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function renderLearningModels(models) {
  document.getElementById("learningModels").innerHTML = models.length ? models.map((item) => `<tr><td><strong>${escapeHtml(item.provider)}</strong><small>${escapeHtml(item.model)}</small></td><td>${item.requestCount}</td><td>${item.averageLatency === null ? "–" : `${item.averageLatency} ms`}</td><td>${item.totalTokens.toLocaleString()}</td><td>${formatMoney(item.estimatedCost)}</td><td>${percent(item.regenerateRate)}</td><td><span class="positive">${percent(item.positiveFeedbackRate)}</span> / <span class="negative">${percent(item.negativeFeedbackRate)}</span></td><td><strong>${Number(item.averageQualityScore).toFixed(2)}</strong></td><td>${percent(item.candidateConversionRate)}</td></tr>`).join("") : '<tr><td colspan="9" class="empty-cell">Model data yoxdur.</td></tr>';
  populateLearningSelect("learningProvider", models.map((item) => item.provider));
  populateLearningSelect("learningModel", models.map((item) => item.model));
}

function renderLearningTasks(tasks) {
  document.getElementById("learningTasks").innerHTML = tasks.length ? tasks.map((item) => `<tr><td><span class="mode-pill ${escapeHtml(item.mode)}">${escapeHtml(item.mode)}</span><strong>${escapeHtml(item.taskType)}</strong></td><td>${item.requestCount}</td><td>${Number(item.averageQualityScore).toFixed(2)}</td><td>${percent(item.regenerateRate)}</td><td>${item.corrections}</td><td>${percent(item.candidateConversionRate)}</td></tr>`).join("") : '<tr><td colspan="6" class="empty-cell">Task data yoxdur.</td></tr>';
  populateLearningSelect("learningTask", tasks.map((item) => item.taskType));
}

function paginationHtml(data, kind) {
  if (data.totalPages <= 1) return `<span>${data.total} nəticə</span>`;
  return `<button class="btn btn-ghost" data-page-kind="${kind}" data-page="${Math.max(1, data.page - 1)}" ${data.page <= 1 ? "disabled" : ""}>←</button><span>${data.page} / ${data.totalPages} · ${data.total} nəticə</span><button class="btn btn-ghost" data-page-kind="${kind}" data-page="${Math.min(data.totalPages, data.page + 1)}" ${data.page >= data.totalPages ? "disabled" : ""}>→</button>`;
}

function renderLearningInteractions(data) {
  document.getElementById("learningInteractions").innerHTML = data.items.length ? data.items.map((item) => `<tr class="clickable-row" data-interaction-id="${escapeHtml(item.id)}"><td>${formatDate(item.createdAt)}</td><td><span class="mode-pill ${escapeHtml(item.mode)}">${escapeHtml(item.mode)}</span><small>${escapeHtml(item.taskType)}</small></td><td>${escapeHtml(item.modelProvider)}<small>${escapeHtml(item.modelName)}</small></td><td>${escapeHtml(item.userPrompt)}</td><td>${escapeHtml(item.modelResponse)}</td><td>${item.latencyMs === null ? "–" : `${item.latencyMs} ms`}</td><td>${item.totalTokens === null ? "–" : item.totalTokens.toLocaleString()}</td><td>${item.estimatedCost === null ? "–" : formatMoney(item.estimatedCost)}</td><td><strong>${Number(item.qualityScore).toFixed(2)}</strong></td><td><span class="review-status ${escapeHtml(item.trainingStatus || "none")}">${escapeHtml(item.trainingStatus || "—")}</span></td></tr>`).join("") : '<tr><td colspan="10" class="empty-cell">Interaction yoxdur.</td></tr>';
  const pagination = document.getElementById("learningInteractionPagination");
  pagination.innerHTML = paginationHtml(data, "interaction");
}

function renderLearningCandidates(data) {
  document.getElementById("learningCandidates").innerHTML = data.items.length ? data.items.map((item) => `<tr class="clickable-row" data-candidate-id="${escapeHtml(item.id)}"><td><strong>${escapeHtml(item.taskType)}</strong></td><td>${escapeHtml(item.sanitizedInput)}</td><td>${escapeHtml(item.preferredOutput)}</td><td><strong>${Number(item.qualityScore).toFixed(2)}</strong></td><td>${escapeHtml(item.candidateReason)}</td><td>${item.containsSensitiveData ? '<span class="privacy-redacted">Redacted</span>' : '<span class="privacy-clean">Clean</span>'}</td><td><span class="review-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td><td>${formatDate(item.createdAt)}</td></tr>`).join("") : '<tr><td colspan="8" class="empty-cell">Candidate yoxdur.</td></tr>';
  document.getElementById("learningCandidatePagination").innerHTML = paginationHtml(data, "candidate");
}

function scoreBreakdown(items = []) {
  return `<div class="score-breakdown">${items.map((item) => `<div><span>${escapeHtml(item.label)} <small>${escapeHtml(item.source)} · ${escapeHtml(item.strength)}</small></span><strong class="${item.value < 0 ? "negative" : "positive"}">${item.value > 0 ? "+" : ""}${Number(item.value).toFixed(2)}</strong></div>`).join("")}</div>`;
}

function openLearningModal(content) {
  document.getElementById("learningModalContent").innerHTML = content;
  document.getElementById("learningModal").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLearningModal() {
  document.getElementById("learningModal").hidden = true;
  document.body.style.overflow = "";
}

async function openInteractionDetail(id) {
  const { interaction: item } = await fetchJSON(`/admin/api/ai-learning/interactions/${encodeURIComponent(id)}`);
  openLearningModal(`<div class="brand-badge">Interaction detail</div><h2 id="learningModalTitle">${escapeHtml(item.mode)} · ${escapeHtml(item.taskType)}</h2><div class="detail-metrics"><span>Provider <strong>${escapeHtml(item.modelProvider)}</strong></span><span>Model <strong>${escapeHtml(item.modelName)}</strong></span><span>Latency <strong>${item.latencyMs ?? "–"} ms</strong></span><span>Tokens <strong>${item.totalTokens ?? "–"}</strong></span><span>Cost <strong>${item.estimatedCost === null ? "Pricing yoxdur" : formatMoney(item.estimatedCost)}</strong></span><span>Quality <strong>${Number(item.qualityScore).toFixed(2)}</strong></span></div><h3>Prompt</h3><pre>${escapeHtml(item.userPrompt)}</pre><h3>Sanitized relevant context</h3><pre>${escapeHtml(JSON.stringify(item.relevantContext, null, 2))}</pre><h3>Model response</h3><pre>${escapeHtml(item.modelResponse)}</pre><h3>Quality score breakdown</h3>${scoreBreakdown(item.qualityBreakdown)}<h3>Signals</h3><pre>${escapeHtml(JSON.stringify(item.signals, null, 2))}</pre><h3>Iteration history</h3>${item.iterations.length ? item.iterations.map((iteration) => `<div class="iteration-card"><strong>V${iteration.iterationNumber}</strong><p>${escapeHtml(iteration.modificationRequest)}</p><pre>${escapeHtml(iteration.response)}</pre></div>`).join("") : '<p class="hint">Iteration yoxdur.</p>'}<h3>Preferred response</h3><pre>${escapeHtml(item.preferredResponse)}</pre><h3>Training candidate</h3><p>${item.candidate ? `<button class="btn btn-ghost" data-modal-candidate="${escapeHtml(item.candidate.id)}">${escapeHtml(item.candidate.status)} candidate-a bax</button>` : "Candidate yaranmayıb."}</p>`);
}

async function openCandidateDetail(id) {
  const { candidate: item } = await fetchJSON(`/admin/api/ai-learning/candidates/${encodeURIComponent(id)}`);
  openLearningModal(`<div class="brand-badge">Training candidate</div><h2 id="learningModalTitle">${escapeHtml(item.taskType)}</h2><div class="detail-metrics"><span>Status <strong>${escapeHtml(item.status)}</strong></span><span>Quality <strong>${Number(item.qualityScore).toFixed(2)}</strong></span><span>Privacy <strong>${item.containsSensitiveData ? "Redacted" : "Clean"}</strong></span><span>Source <strong>${escapeHtml(item.sourceModelProvider)} / ${escapeHtml(item.sourceModelName)}</strong></span></div><h3>Sanitized input</h3><pre>${escapeHtml(item.sanitizedInput)}</pre><h3>Preferred output</h3><pre>${escapeHtml(item.preferredOutput)}</pre><h3>Candidate reason</h3><p>${escapeHtml(item.candidateReason)}</p><h3>Quality breakdown</h3>${scoreBreakdown(item.qualityBreakdown)}<h3>Sanitization result</h3><pre>${escapeHtml(JSON.stringify(item.sanitizationResult, null, 2))}</pre><h3>Response iterations</h3><pre>${escapeHtml(JSON.stringify(item.iterations, null, 2))}</pre><div class="review-actions"><button class="btn btn-ghost" data-review-id="${escapeHtml(item.id)}" data-review-status="pending">Keep Pending</button><button class="btn btn-danger" data-review-id="${escapeHtml(item.id)}" data-review-status="rejected">Reject</button><button class="btn btn-approve" data-review-id="${escapeHtml(item.id)}" data-review-status="approved">Approve for Training</button></div>`);
}

async function loadAiLearning() {
  const query = learningQuery();
  try {
    const [overview, growth, modelsData, tasksData, interactions, candidates] = await Promise.all([
      fetchJSON(`/admin/api/ai-learning/overview?${query}`), fetchJSON(`/admin/api/ai-learning/growth?${query}`),
      fetchJSON(`/admin/api/ai-learning/models?${query}`), fetchJSON(`/admin/api/ai-learning/tasks?${query}`),
      fetchJSON(`/admin/api/ai-learning/interactions?${learningQuery({ page: learningState.interactionPage, pageSize: 20 })}`),
      fetchJSON(`/admin/api/ai-learning/candidates?${learningQuery({ page: learningState.candidatePage, pageSize: 20, status: document.getElementById("learningCandidateStatus")?.value || "all" })}`),
    ]);
    renderLearningKpis(overview); renderGrowth(growth.points); renderLearningModels(modelsData.models); renderLearningTasks(tasksData.tasks); renderLearningInteractions(interactions); renderLearningCandidates(candidates);
    learningState.loaded = true;
  } catch (error) {
    console.error("AI Learning loading error:", error);
    document.getElementById("learningKpis").innerHTML = `<div class="empty-state error">AI Learning məlumatı yüklənmədi: ${escapeHtml(error.message)}</div>`;
  }
}

// -------------------------------------------------------------
// ⚖️ LEGAL REPORTS DASHBOARD
// -------------------------------------------------------------
let allLegalReports = [];

async function loadLegalReports() {
  const container = document.getElementById("legal-reports-container");
  const elTotal = document.getElementById("stat-legal-total");
  const elPending = document.getElementById("stat-legal-pending");
  const elInReview = document.getElementById("stat-legal-inreview");
  const elResolved = document.getElementById("stat-legal-resolved");
  const badgePending = document.getElementById("badgePendingLegal");

  try {
    const data = await fetchJSON("/admin/api/legal-reports");
    allLegalReports = Array.isArray(data.reports) ? data.reports : [];

    const stats = data.stats || {
      total: allLegalReports.length,
      pending: allLegalReports.filter((r) => !r.status || r.status === "received").length,
      inReview: allLegalReports.filter((r) => r.status === "in_review").length,
      resolved: allLegalReports.filter((r) => r.status === "resolved").length,
    };

    if (elTotal) elTotal.textContent = stats.total;
    if (elPending) elPending.textContent = stats.pending;
    if (elInReview) elInReview.textContent = stats.inReview;
    if (elResolved) elResolved.textContent = stats.resolved;
    if (badgePending) {
      badgePending.textContent = stats.pending;
      badgePending.style.display = stats.pending > 0 ? "inline-flex" : "none";
    }

    renderLegalReports();
  } catch (err) {
    console.error("Legal reports loading error:", err);
    if (container) {
      container.innerHTML = `<div class="empty-state error">Müraciətlər yüklənərkən xəta baş verdi: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderLegalReports() {
  const container = document.getElementById("legal-reports-container");
  if (!container) return;

  const searchVal = (document.getElementById("legalSearchInput")?.value || "").toLowerCase().trim();
  const statusFilter = document.getElementById("legalStatusFilter")?.value || "all";
  const typeFilter = document.getElementById("legalTypeFilter")?.value || "all";

  const filtered = allLegalReports.filter((rep) => {
    const currentStatus = rep.status || "received";
    if (statusFilter !== "all" && currentStatus !== statusFilter) return false;
    if (typeFilter !== "all" && rep.issueType !== typeFilter) return false;

    if (searchVal) {
      const matchText = [
        rep.issueType,
        rep.description,
        rep.userEmail,
        rep.userName,
        rep.model,
        rep.messageContent,
        rep.id,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!matchText.includes(searchVal)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚖️</span>
        <p>Heç bir hüquqi problem müraciəti tapılmadı.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  filtered.forEach((rep) => {
    const currentStatus = rep.status || "received";
    const statusLabels = {
      received: "Gözləyir",
      in_review: "Baxılır",
      resolved: "Həll olundu",
    };
    const statusClasses = {
      received: "status-received",
      in_review: "status-inreview",
      resolved: "status-resolved",
    };

    const card = document.createElement("div");
    card.className = `legal-card ${statusClasses[currentStatus] || ""}`;

    const dateStr = formatDate(rep.createdAt);
    const userDisplay = rep.userName || "Anonim istifadəçi";
    const emailDisplay = rep.userEmail ? `<a href="mailto:${escapeHtml(rep.userEmail)}?subject=Marketify AI Hüquqi Müraciətiniz Barədə [${escapeHtml(rep.id || "")}]" class="legal-email-link" title="E-poçt göndər">✉️ ${escapeHtml(rep.userEmail)}</a>` : '<span class="text-muted">E-poçt qeyd olunmayıb</span>';
    const modelBadge = rep.model ? `<span class="model-badge">${escapeHtml(rep.model)}</span>` : "";

    card.innerHTML = `
      <div class="legal-card-header">
        <div class="legal-card-type-row">
          <span class="issue-badge">${escapeHtml(rep.issueType || "Ümumi")}</span>
          <span class="status-badge ${statusClasses[currentStatus]}">${statusLabels[currentStatus] || currentStatus}</span>
          ${modelBadge}
        </div>
        <div class="legal-card-date" title="${escapeHtml(rep.createdAt || "")}">${dateStr}</div>
      </div>

      <div class="legal-user-meta">
        <div class="meta-item"><strong>İstifadəçi:</strong> ${escapeHtml(userDisplay)}</div>
        <div class="meta-item"><strong>Əlaqə:</strong> ${emailDisplay}</div>
        ${rep.ip ? `<div class="meta-item"><strong>IP:</strong> <code>${escapeHtml(rep.ip)}</code></div>` : ""}
      </div>

      <div class="legal-section-title">İstifadəçinin Şikayəti / Təsvir:</div>
      <div class="legal-desc-box">${escapeHtml(rep.description || "")}</div>

      ${rep.messageContent ? `
        <details class="legal-ai-details">
          <summary class="legal-ai-summary">
            <span>İstinad edilən AI Cavabı</span>
            <span class="badge">aç / bağla</span>
          </summary>
          <div class="legal-ai-content">${escapeHtml(rep.messageContent)}</div>
        </details>
      ` : ""}

      <div class="legal-card-actions">
        <div class="status-select-wrap">
          <label for="status_${escapeHtml(rep.id)}">Status:</label>
          <select class="status-select" id="status_${escapeHtml(rep.id)}" data-id="${escapeHtml(rep.id)}">
            <option value="received" ${currentStatus === "received" ? "selected" : ""}>⏳ Gözləyir</option>
            <option value="in_review" ${currentStatus === "in_review" ? "selected" : ""}>🔍 Baxılır</option>
            <option value="resolved" ${currentStatus === "resolved" ? "selected" : ""}>✅ Həll olundu</option>
          </select>
        </div>

        <div class="action-buttons">
          ${rep.userEmail ? `
            <a href="mailto:${escapeHtml(rep.userEmail)}?subject=Marketify AI Hüquqi Müraciətiniz [${escapeHtml(rep.id || "")}]" class="btn btn-email">
              ✉️ Cavab yaz
            </a>
          ` : ""}
          <button type="button" class="btn btn-copy" data-id="${escapeHtml(rep.id)}">
            📋 Kopyala
          </button>
          <button type="button" class="btn btn-danger btn-delete" data-id="${escapeHtml(rep.id)}">
            🗑 Sil
          </button>
        </div>
      </div>
    `;

    // Status change listener
    const statusSelect = card.querySelector(".status-select");
    statusSelect?.addEventListener("change", async (e) => {
      const newStatus = e.target.value;
      try {
        await fetchJSON("/admin/api/legal-reports/status", {
          method: "POST",
          body: JSON.stringify({ id: rep.id, status: newStatus }),
        });
        rep.status = newStatus;
        loadLegalReports();
      } catch (err) {
        alert("Status dəyişdirilərkən xəta: " + err.message);
        statusSelect.value = currentStatus;
      }
    });

    // Delete listener
    const deleteBtn = card.querySelector(".btn-delete");
    deleteBtn?.addEventListener("click", async () => {
      if (!confirm("Bu hüquqi müraciəti arxivdən silmək istədiyinizə əminsiniz?")) return;
      try {
        await fetchJSON("/admin/api/legal-reports/delete", {
          method: "POST",
          body: JSON.stringify({ id: rep.id }),
        });
        allLegalReports = allLegalReports.filter((r) => r.id !== rep.id);
        loadLegalReports();
      } catch (err) {
        alert("Silmə xətası: " + err.message);
      }
    });

    // Copy listener
    const copyBtn = card.querySelector(".btn-copy");
    copyBtn?.addEventListener("click", () => {
      const copyText = `[Marketify AI Hüquqi Müraciət #${rep.id}]\nTarix: ${dateStr}\nNöv: ${rep.issueType}\nİstifadəçi: ${userDisplay} (${rep.userEmail || "email yoxdur"})\nModel: ${rep.model || "Məlum deyil"}\n\nTəsvir:\n${rep.description}\n\nAI Cavabı:\n${rep.messageContent || "(yoxdur)"}`;
      navigator.clipboard.writeText(copyText).then(() => {
        copyBtn.textContent = "✓ Kopyalandı";
        setTimeout(() => copyBtn.textContent = "📋 Kopyala", 1500);
      });
    });

    container.appendChild(card);
  });
}

// -------------------------------------------------------------
// 🧠 BRAIN & ŞABLONLAR
// -------------------------------------------------------------
async function loadStats() {
  const elTemplates = document.getElementById("stat-templates");
  const elIntents = document.getElementById("stat-intents");
  const elLogs = document.getElementById("stat-logs");

  try {
    const stats = await fetchJSON("/admin/api/stats");
    if (elTemplates) elTemplates.textContent = stats.totalTemplates ?? 0;
    if (elIntents) elIntents.textContent = stats.totalIntents ?? 0;
    if (elLogs) elLogs.textContent = stats.totalLogEntries ?? 0;
  } catch (err) {
    console.error("Stats xətası:", err);
  }
}

async function loadTemplates() {
  const container = document.getElementById("templates-container");
  if (!container) return;
  container.innerHTML = "";

  try {
    const { base, trash } = await fetchJSON("/admin/api/templates");
    const intents = Object.keys(base || {});

    if (!intents.length) {
      container.innerHTML = '<p class="hint">Hələ heç bir şablon öyrənilməyib. Marketify bir az işləsin, sonra geri qayıdarsan. 😊</p>';
      return;
    }

    intents.forEach((intent) => {
      const items = Array.isArray(base[intent]) ? base[intent] : [];
      const trashItems = Array.isArray(trash?.[intent]) ? trash[intent] : [];

      const block = document.createElement("div");
      block.className = "intent-block";

      const header = document.createElement("div");
      header.className = "intent-header";

      const left = document.createElement("div");
      const name = document.createElement("div");
      name.className = "intent-name";
      name.textContent = intent;

      const count = document.createElement("div");
      count.className = "intent-count";
      count.textContent = `Aktiv: ${items.length} | Trash: ${trashItems.length}`;

      left.appendChild(name);
      left.appendChild(count);

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "kliklə aç/bağla";

      header.appendChild(left);
      header.appendChild(badge);

      const list = document.createElement("div");
      list.className = "intent-templates";
      list.style.display = "none";

      items.forEach((t, index) => {
        const item = document.createElement("div");
        item.className = "template-item";
        const text = document.createElement("div");
        text.className = "template-text";
        text.textContent = t.template;

        const meta = document.createElement("div");
        meta.className = "template-meta";
        const info = document.createElement("span");
        info.textContent = `Əlavə olunub: ${t.createdAt ? formatDate(t.createdAt) : "–"}`;

        const btn = document.createElement("button");
        btn.className = "btn btn-danger";
        btn.textContent = "Trash-a at";
        btn.addEventListener("click", async () => {
          if (!confirm(`Bu şablonu trash-a atmaq istədiyinizə əminsiniz? [${intent} #${index}]`)) return;
          await fetchJSON("/admin/api/templates/delete", {
            method: "POST",
            body: JSON.stringify({ intent, index }),
          });
          await loadTemplates();
          await loadStats();
        });

        meta.appendChild(info);
        meta.appendChild(btn);
        item.appendChild(text);
        item.appendChild(meta);
        list.appendChild(item);
      });

      trashItems.forEach((t, index) => {
        const item = document.createElement("div");
        item.className = "template-item";
        const text = document.createElement("div");
        text.className = "template-text";
        text.textContent = t.template;

        const meta = document.createElement("div");
        meta.className = "template-meta";
        const info = document.createElement("span");
        info.textContent = `Trash: ${t.deletedAt ? formatDate(t.deletedAt) : "–"}`;

        const btn = document.createElement("button");
        btn.className = "btn btn-ghost";
        btn.textContent = "Bərpa et";
        btn.addEventListener("click", async () => {
          await fetchJSON("/admin/api/templates/restore", {
            method: "POST",
            body: JSON.stringify({ intent, index }),
          });
          await loadTemplates();
          await loadStats();
        });

        meta.appendChild(info);
        meta.appendChild(btn);
        item.appendChild(text);
        item.appendChild(meta);
        list.appendChild(item);
      });

      header.addEventListener("click", () => {
        list.style.display = list.style.display === "none" ? "block" : "none";
      });

      block.appendChild(header);
      block.appendChild(list);
      container.appendChild(block);
    });
  } catch (err) {
    console.error("Templates xətası:", err);
  }
}

// -------------------------------------------------------------
// 📜 GPT CAVAB LOGLARI
// -------------------------------------------------------------
async function loadLogs() {
  const container = document.getElementById("logs-container");
  if (!container) return;
  container.innerHTML = "";

  try {
    const { entries } = await fetchJSON("/admin/api/logs?limit=40");

    if (!entries || !entries.length) {
      container.innerHTML = '<p class="hint">Hələ log yoxdur. GPT cavabları gəldikcə bura dolacaq. 🧠</p>';
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "log-item";

      const q = document.createElement("div");
      q.className = "log-question";
      q.textContent = entry.question;

      const intent = document.createElement("div");
      intent.className = "log-intent";
      intent.textContent = `Intent: ${entry.intent || "–"}`;

      const time = document.createElement("div");
      time.className = "log-time";
      time.textContent = entry.createdAt ? formatDate(entry.createdAt) : "–";

      item.appendChild(q);
      item.appendChild(intent);
      item.appendChild(time);
      container.appendChild(item);
    });
  } catch (err) {
    console.error("Log oxuma xətası:", err);
  }
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  loadLegalReports();

  // Search & Filter event listeners
  document.getElementById("legalSearchInput")?.addEventListener("input", renderLegalReports);
  document.getElementById("legalStatusFilter")?.addEventListener("change", renderLegalReports);
  document.getElementById("legalTypeFilter")?.addEventListener("change", renderLegalReports);
  document.getElementById("btnRefreshLegal")?.addEventListener("click", loadLegalReports);
  document.getElementById("learningRefresh")?.addEventListener("click", loadAiLearning);
  document.getElementById("learningFilters")?.addEventListener("change", () => {
    learningState.interactionPage = 1;
    learningState.candidatePage = 1;
    loadAiLearning();
  });
  document.getElementById("tabContentLearning")?.addEventListener("click", (event) => {
    const interaction = event.target.closest("[data-interaction-id]");
    const candidate = event.target.closest("[data-candidate-id]");
    const pageButton = event.target.closest("[data-page-kind]");
    if (interaction) openInteractionDetail(interaction.dataset.interactionId);
    if (candidate) openCandidateDetail(candidate.dataset.candidateId);
    if (pageButton && !pageButton.disabled) {
      if (pageButton.dataset.pageKind === "interaction") learningState.interactionPage = Number(pageButton.dataset.page);
      else learningState.candidatePage = Number(pageButton.dataset.page);
      loadAiLearning();
    }
  });
  document.getElementById("learningModal")?.addEventListener("click", async (event) => {
    if (event.target.closest("[data-close-learning-modal]")) closeLearningModal();
    const candidateLink = event.target.closest("[data-modal-candidate]");
    if (candidateLink) openCandidateDetail(candidateLink.dataset.modalCandidate);
    const review = event.target.closest("[data-review-id]");
    if (review) {
      review.disabled = true;
      try {
        await fetchJSON(`/admin/api/ai-learning/candidates/${encodeURIComponent(review.dataset.reviewId)}/review`, { method: "POST", body: JSON.stringify({ status: review.dataset.reviewStatus }) });
        closeLearningModal();
        loadAiLearning();
      } catch (error) {
        alert(`Review xətası: ${error.message}`);
        review.disabled = false;
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("learningModal")?.hidden) closeLearningModal();
  });
});
