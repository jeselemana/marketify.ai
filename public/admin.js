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
    });
  });
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
});