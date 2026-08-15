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

export function createDocumentExport(strategy) {
  const sections = strategy.sections
    .map(
      (section) => `<section><h2>${escapeDocument(section.title)}</h2><p>${escapeDocument(
        section.content,
      )}</p><ul>${section.bullets.map((item) => `<li>${escapeDocument(item)}</li>`).join("")}</ul></section>`,
    )
    .join("");
  const phases = strategy.actionPlan
    .map(
      (phase) => `<section><h3>${escapeDocument(phase.phase)}</h3><ul>${phase.actions
        .map((item) => `<li>${escapeDocument(item)}</li>`)
        .join("")}</ul><p><strong>Gözlənilən nəticə:</strong> ${escapeDocument(phase.expectedOutcome)}</p></section>`,
    )
    .join("");
  const content = `<!doctype html><html lang="az"><head><meta charset="utf-8"><title>${escapeDocument(
    strategy.title,
  )}</title><style>body{font:16px/1.65 system-ui;max-width:820px;margin:48px auto;padding:0 24px;color:#172033}h1{font-size:36px}h2{margin-top:36px;border-top:1px solid #dfe3ea;padding-top:24px}h3{margin-top:24px}p{white-space:pre-line}li{margin:7px 0}.summary{font-size:19px;color:#465269}</style></head><body><h1>${escapeDocument(
    strategy.title,
  )}</h1><p class="summary">${escapeDocument(strategy.summary)}</p><h2>Strategiya</h2>${sections}<h2>İcra planı</h2>${phases}<h2>KPI-lar</h2><ul>${strategy.kpis
    .map((kpi) => `<li><strong>${escapeDocument(kpi.name)}</strong> — ${escapeDocument(kpi.reason)} ${escapeDocument(kpi.target)}</li>`)
    .join("")}</ul><h2>Növbəti addımlar</h2><ol>${strategy.nextSteps
    .map((item) => `<li>${escapeDocument(item)}</li>`)
    .join("")}</ol></body></html>`;

  return { content, type: "text/html;charset=utf-8", extension: "html" };
}

export function createSpreadsheetExport(strategy) {
  const rows = [["Növ", "Faza / ad", "Fəaliyyət / təsvir", "Prioritet / hədəf", "Gözlənilən nəticə"]];
  strategy.priorities.forEach((item) => rows.push(["Prioritet", item.title, item.description, item.priority, ""]));
  strategy.actionPlan.forEach((phase) =>
    phase.actions.forEach((action) => rows.push(["Fəaliyyət planı", phase.phase, action, "", phase.expectedOutcome])),
  );
  strategy.kpis.forEach((kpi) => rows.push(["KPI", kpi.name, kpi.reason, kpi.target, ""]));
  strategy.risks.forEach((risk) => rows.push(["Risk", risk.risk, risk.mitigation, "", ""]));
  const content = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;

  return { content, type: "text/csv;charset=utf-8", extension: "csv" };
}
