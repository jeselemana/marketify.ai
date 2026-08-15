import test from "node:test";
import assert from "node:assert/strict";
import { createDocumentExport, createSpreadsheetExport } from "../public/exporters.js";

const strategy = {
  title: "Launch <script>alert(1)</script>",
  summary: "Safe summary",
  sections: [{ title: "Positioning", content: "Premium & useful", bullets: ["Clear promise"] }],
  priorities: [{ title: "Validate", description: "Test demand", priority: "high" }],
  actionPlan: [{ phase: "Week 1", actions: ["Launch test"], expectedOutcome: "Baseline" }],
  kpis: [{ name: "Qualified leads", reason: "Measures demand", target: "20" }],
  risks: [{ risk: "Low response", mitigation: "Test a second message" }],
  nextSteps: ["Approve the pilot"],
};

test("document export escapes untrusted strategy content", () => {
  const file = createDocumentExport(strategy);
  assert.equal(file.extension, "html");
  assert.doesNotMatch(file.content, /<script>alert/);
  assert.match(file.content, /&lt;script&gt;alert/);
  assert.match(file.content, /Premium &amp; useful/);
});

test("spreadsheet export keeps action-plan, priority, KPI, and risk rows separate", () => {
  const file = createSpreadsheetExport(strategy);
  assert.equal(file.extension, "csv");
  assert.match(file.content, /"Prioritet"/);
  assert.match(file.content, /"Fəaliyyət planı"/);
  assert.match(file.content, /"KPI"/);
  assert.match(file.content, /"Risk"/);
});
