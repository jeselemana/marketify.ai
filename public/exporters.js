function escapeDocument(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function createPdfPrintDocument(strategy) {
  const dateStr = new Date().toLocaleDateString("az-AZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prioritiesHtml = (strategy.priorities || [])
    .map(
      (p) => `
      <div class="pdf-card no-break">
        <div class="pdf-card-top">
          <span class="pdf-badge pdf-badge-priority">${escapeDocument(p.priority || "Prioritet")}</span>
          <h4 class="pdf-card-title">${escapeDocument(p.title)}</h4>
        </div>
        <p class="pdf-card-desc">${escapeDocument(p.description)}</p>
      </div>`,
    )
    .join("");

  const sectionsHtml = (strategy.sections || [])
    .map(
      (section) => `
      <div class="pdf-card no-break">
        <h4 class="pdf-card-title">${escapeDocument(section.title)}</h4>
        <p class="pdf-card-desc">${escapeDocument(section.content)}</p>
        ${
          section.bullets && section.bullets.length
            ? `<ul class="pdf-list">${section.bullets.map((b) => `<li>${escapeDocument(b)}</li>`).join("")}</ul>`
            : ""
        }
      </div>`,
    )
    .join("");

  const actionPlanHtml = (strategy.actionPlan || [])
    .map(
      (phase, idx) => `
      <div class="pdf-card pdf-phase-card no-break">
        <div class="pdf-phase-header">
          <span class="pdf-badge pdf-badge-phase">Mərhələ ${idx + 1}</span>
          <h4 class="pdf-card-title">${escapeDocument(phase.phase)}</h4>
        </div>
        <ul class="pdf-list">
          ${phase.actions.map((act) => `<li>${escapeDocument(act)}</li>`).join("")}
        </ul>
        ${
          phase.expectedOutcome
            ? `<div class="pdf-outcome"><strong>🎯 Gözlənilən nəticə:</strong> ${escapeDocument(phase.expectedOutcome)}</div>`
            : ""
        }
      </div>`,
    )
    .join("");

  const kpisHtml = (strategy.kpis || [])
    .map(
      (kpi) => `
      <div class="pdf-card pdf-kpi-card no-break">
        <h4 class="pdf-kpi-title">${escapeDocument(kpi.name)}</h4>
        <p class="pdf-kpi-target"><strong>Hədəf:</strong> ${escapeDocument(kpi.target)}</p>
        <p class="pdf-card-desc">${escapeDocument(kpi.reason)}</p>
      </div>`,
    )
    .join("");

  const risksHtml = (strategy.risks || [])
    .map(
      (risk) => `
      <div class="pdf-card pdf-risk-card no-break">
        <div class="pdf-risk-header">
          <span class="pdf-badge pdf-badge-risk">Risk</span>
          <h4 class="pdf-card-title">${escapeDocument(risk.risk)}</h4>
        </div>
        <p class="pdf-card-desc"><strong>Həll yolu:</strong> ${escapeDocument(risk.mitigation)}</p>
      </div>`,
    )
    .join("");

  const chunkSize = Math.max(1, Math.ceil((strategy.nextSteps || []).length / 3));
  const groupLabels = ["Bu gün", "Növbəti 48 saat", "Bu həftə"];
  const nextStepsHtml = groupLabels
    .map((label, gIdx) => {
      const items = (strategy.nextSteps || []).slice(gIdx * chunkSize, (gIdx + 1) * chunkSize);
      if (!items.length) return "";
      return `
      <div class="pdf-next-col no-break">
        <h4 class="pdf-next-heading">${escapeDocument(label)}</h4>
        <ul class="pdf-checklist">
          ${items.map((item) => `<li><span class="pdf-check-box">☐</span> ${escapeDocument(item)}</li>`).join("")}
        </ul>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="az">
<head>
  <meta charset="utf-8">
  <title>${escapeDocument(strategy.title)} — Marketify AI Strateji Hesabat</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm 16mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 13px;
      line-height: 1.55;
    }
    .pdf-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 24px;
    }
    .pdf-brand {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
    }
    .pdf-brand span {
      color: #2563eb;
    }
    .pdf-date {
      font-size: 11.5px;
      color: #64748b;
      font-weight: 500;
    }
    .pdf-hero {
      margin-bottom: 28px;
    }
    .pdf-kicker {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #2563eb;
      margin-bottom: 6px;
    }
    .pdf-title {
      margin: 0 0 10px;
      font-size: 24px;
      font-weight: 800;
      line-height: 1.25;
      color: #0f172a;
      letter-spacing: -0.015em;
    }
    .pdf-summary {
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      background: #f8fafc;
      padding: 14px 16px;
      border-radius: 8px;
      border-left: 4px solid #2563eb;
    }
    .pdf-section {
      margin-bottom: 26px;
    }
    .pdf-section-title {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      text-transform: uppercase;
    }
    .pdf-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .pdf-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .pdf-card {
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }
    .pdf-card-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .pdf-card-title {
      margin: 0 0 4px;
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .pdf-card-desc {
      margin: 0;
      font-size: 12px;
      color: #475569;
      line-height: 1.5;
    }
    .pdf-badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .pdf-badge-priority {
      background: #eff6ff;
      color: #2563eb;
    }
    .pdf-badge-phase {
      background: #f1f5f9;
      color: #0f172a;
    }
    .pdf-badge-risk {
      background: #fef2f2;
      color: #dc2626;
    }
    .pdf-phase-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .pdf-list {
      margin: 6px 0 0 16px;
      padding: 0;
      font-size: 12px;
      color: #334155;
    }
    .pdf-list li {
      margin-bottom: 4px;
    }
    .pdf-outcome {
      margin-top: 8px;
      padding: 6px 10px;
      border-radius: 6px;
      background: #f8fafc;
      font-size: 11.5px;
      color: #1e293b;
    }
    .pdf-kpi-card {
      border-left: 3px solid #10b981;
    }
    .pdf-kpi-title {
      margin: 0 0 2px;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .pdf-kpi-target {
      margin: 0 0 4px;
      font-size: 12px;
      color: #059669;
      font-weight: 600;
    }
    .pdf-risk-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .pdf-next-col {
      padding: 12px 14px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .pdf-next-heading {
      margin: 0 0 8px;
      font-size: 12.5px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    .pdf-checklist {
      list-style: none;
      margin: 0;
      padding: 0;
      font-size: 11.5px;
      color: #334155;
    }
    .pdf-checklist li {
      margin-bottom: 6px;
      line-height: 1.45;
    }
    .pdf-check-box {
      color: #94a3b8;
      font-size: 13px;
      margin-right: 4px;
    }
    .pdf-footer {
      margin-top: 32px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #94a3b8;
    }
    .no-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <header class="pdf-header">
    <div class="pdf-brand">Marketify<span>.ai</span></div>
    <div class="pdf-date">${dateStr}</div>
  </header>

  <div class="pdf-hero">
    <div class="pdf-kicker">Strateji Hesabat & İcra Planı</div>
    <h1 class="pdf-title">${escapeDocument(strategy.title)}</h1>
    <p class="pdf-summary">${escapeDocument(strategy.summary)}</p>
  </div>

  ${
    prioritiesHtml
      ? `<section class="pdf-section">
          <h3 class="pdf-section-title">01. Strateji Prioritetlər</h3>
          <div class="pdf-grid">${prioritiesHtml}</div>
        </section>`
      : ""
  }

  ${
    sectionsHtml
      ? `<section class="pdf-section">
          <h3 class="pdf-section-title">02. Strateji Qərarlar və İstiqamət</h3>
          <div class="pdf-grid">${sectionsHtml}</div>
        </section>`
      : ""
  }

  ${
    actionPlanHtml
      ? `<section class="pdf-section">
          <h3 class="pdf-section-title">03. İcra Mərhələləri</h3>
          <div class="pdf-grid">${actionPlanHtml}</div>
        </section>`
      : ""
  }

  ${
    kpisHtml
      ? `<section class="pdf-section">
          <h3 class="pdf-section-title">04. Uğur və KPI Hədəfləri</h3>
          <div class="pdf-grid">${kpisHtml}</div>
        </section>`
      : ""
  }

  ${
    risksHtml
      ? `<section class="pdf-section">
          <h3 class="pdf-section-title">05. Risklər və Həll Yolları</h3>
          <div class="pdf-grid">${risksHtml}</div>
        </section>`
      : ""
  }

  ${
    nextStepsHtml
      ? `<section class="pdf-section">
          <h3 class="pdf-section-title">06. Növbəti Addımlar</h3>
          <div class="pdf-grid-3">${nextStepsHtml}</div>
        </section>`
      : ""
  }

  <footer class="pdf-footer">
    <span>Marketify AI platformasında generasiya olunub • marketify-ai.com</span>
    <span>Səhifə 1</span>
  </footer>
</body>
</html>`;
}

export function exportStrategyToPDF(strategy) {
  const content = createPdfPrintDocument(strategy);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 350);
  } else {
    // Fallback if popup blocked: use hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 2500);
    }, 350);
  }
}

export function createDocumentExport(strategy) {
  const sections = (strategy.sections || [])
    .map(
      (section) => `<section><h2>${escapeDocument(section.title)}</h2><p>${escapeDocument(
        section.content,
      )}</p><ul>${(section.bullets || []).map((item) => `<li>${escapeDocument(item)}</li>`).join("")}</ul></section>`,
    )
    .join("");
  const phases = (strategy.actionPlan || [])
    .map(
      (phase) => `<section><h3>${escapeDocument(phase.phase)}</h3><ul>${(phase.actions || [])
        .map((item) => `<li>${escapeDocument(item)}</li>`)
        .join("")}</ul><p><strong>Gözlənilən nəticə:</strong> ${escapeDocument(phase.expectedOutcome)}</p></section>`,
    )
    .join("");
  const content = `<!doctype html><html lang="az"><head><meta charset="utf-8"><title>${escapeDocument(
    strategy.title,
  )}</title><style>body{font:16px/1.65 system-ui;max-width:820px;margin:48px auto;padding:0 24px;color:#172033}h1{font-size:36px}h2{margin-top:36px;border-top:1px solid #dfe3ea;padding-top:24px}h3{margin-top:24px}p{white-space:pre-line}li{margin:7px 0}.summary{font-size:19px;color:#465269}</style></head><body><h1>${escapeDocument(
    strategy.title,
  )}</h1><p class="summary">${escapeDocument(strategy.summary)}</p><h2>Strategiya</h2>${sections}<h2>İcra planı</h2>${phases}<h2>KPI-lar</h2><ul>${(strategy.kpis || [])
    .map((kpi) => `<li><strong>${escapeDocument(kpi.name)}</strong> — ${escapeDocument(kpi.reason)} ${escapeDocument(kpi.target)}</li>`)
    .join("")}</ul><h2>Növbəti addımlar</h2><ol>${(strategy.nextSteps || [])
    .map((item) => `<li>${escapeDocument(item)}</li>`)
    .join("")}</ol></body></html>`;

  return { content, type: "text/html;charset=utf-8", extension: "html" };
}

export function createSpreadsheetExport(strategy) {
  const rows = [["Növ", "Faza / ad", "Fəaliyyət / təsvir", "Prioritet / hədəf", "Gözlənilən nəticə"]];
  (strategy.priorities || []).forEach((item) => rows.push(["Prioritet", item.title, item.description, item.priority, ""]));
  (strategy.actionPlan || []).forEach((phase) =>
    (phase.actions || []).forEach((action) => rows.push(["Fəaliyyət planı", phase.phase, action, "", phase.expectedOutcome])),
  );
  (strategy.kpis || []).forEach((kpi) => rows.push(["KPI", kpi.name, kpi.reason, kpi.target, ""]));
  (strategy.risks || []).forEach((risk) => rows.push(["Risk", risk.risk, risk.mitigation, "", ""]));
  const content = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;

  return { content, type: "text/csv;charset=utf-8", extension: "csv" };
}
