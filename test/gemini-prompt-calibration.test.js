import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  EPISTEMIC_HUMILITY_RULES,
  STRATEGY_PROMPT,
  REFINEMENT_PROMPT,
  ASSESSOR_PROMPT,
  ASK_INSTRUCTIONS,
  LOCAL_AZ_MODE_RULES,
  buildStrategyPrompt,
  buildAssessorPrompt,
  buildRefinementPrompt,
  buildAskPrompt,
} from "../src/services/ai/prompts.js";

test("1. EPISTEMIC_HUMILITY_RULES defines epistemic humility, honest uncertainty, and proactive solutions", () => {
  // Epistemic humility & honest acknowledgement
  assert.match(EPISTEMIC_HUMILITY_RULES, /Dürüstlük və Qeyri-müəyyənliyin İdarə Edilməsi/i);
  assert.match(EPISTEMIC_HUMILITY_RULES, /Bu sahə üzrə dəqiq rəsmi statistika əlimizdə yoxdur/);
  assert.match(EPISTEMIC_HUMILITY_RULES, /Bu detal məlum deyil/);

  // Prohibition on dead-end refusals ('bilmirəm') & proactive solutions mandate
  assert.match(EPISTEMIC_HUMILITY_RULES, /bilmirəm/);
  assert.match(EPISTEMIC_HUMILITY_RULES, /Ssenari A və Ssenari B/);
  assert.match(EPISTEMIC_HUMILITY_RULES, /addım-addım praktiki istiqamət/);
});

test("2. EPISTEMIC_HUMILITY_RULES strictly bans invented numbers and mandates ranges or formulas", () => {
  // Ban on invented numbers
  assert.match(EPISTEMIC_HUMILITY_RULES, /Rəqəm və Metrika İntizamı/i);
  assert.match(EPISTEMIC_HUMILITY_RULES, /aylıq 4,820 AZN/);
  assert.match(EPISTEMIC_HUMILITY_RULES, /bazarın 18\.4%-i/);

  // Mandatory range & benchmark or formula
  assert.match(EPISTEMIC_HUMILITY_RULES, /Bakı bazarında bu tip kampaniyalar üçün ilkin test büdcəsi adətən 500 – 1,200 AZN aralığında götürülür/);
  assert.match(EPISTEMIC_HUMILITY_RULES, /düstur\/məntiq ver və istifadəçidən əsas dəyişəni soruş/);
});

test("3. EPISTEMIC_HUMILITY_RULES balances bold operator tone against timid AI disclaimers", () => {
  // Avoid timid AI disclaimers
  assert.match(EPISTEMIC_HUMILITY_RULES, /Qorxaq AI/i);
  assert.match(EPISTEMIC_HUMILITY_RULES, /Mən sadəcə süni intellektəm/);
  assert.match(EPISTEMIC_HUMILITY_RULES, /Maliyyə məsləhəti deyil/);

  // Direct, confident leadership under uncertainty
  assert.match(EPISTEMIC_HUMILITY_RULES, /Bunu dəqiqləşdirmək lazımdır, amma gələn nəticəyə görə iki alternativ yolumuz var: A və B/);
});

test("4. Build Mode: STRATEGY_PROMPT, REFINEMENT_PROMPT, and ASSESSOR_PROMPT incorporate epistemic humility", () => {
  // Strategy prompt contains epistemic humility rules and local AZ mode rules
  assert.match(STRATEGY_PROMPT, /EPISTEMIC HUMILITY/i);
  assert.match(STRATEGY_PROMPT, /aylıq 4,820 AZN/);
  assert.match(STRATEGY_PROMPT, /Bakı bazarında bu tip kampaniyalar üçün ilkin test büdcəsi adətən 500 – 1,200 AZN aralığında götürülür/);
  assert.match(STRATEGY_PROMPT, /\[LOCAL_AZ_MODE\]/);

  // Refinement prompt contains epistemic humility rules
  assert.match(REFINEMENT_PROMPT, /EPISTEMIC HUMILITY/i);
  assert.match(REFINEMENT_PROMPT, /aylıq 4,820 AZN/);

  // Assessor prompt contains epistemic humility instruction
  assert.match(ASSESSOR_PROMPT, /Epistemic Humility/i);
  assert.match(ASSESSOR_PROMPT, /working assumptions with benchmark ranges/i);
});

test("5. LOCAL_AZ_MODE_RULES integrates metric discipline and senior strategist tone without breaking existing laws", () => {
  // Metric discipline in local mode finance
  assert.match(LOCAL_AZ_MODE_RULES, /Rəqəm və Metrika İntizamı/);
  assert.match(LOCAL_AZ_MODE_RULES, /500 – 1,200 AZN/);

  // Style and tone guidance in local mode
  assert.match(LOCAL_AZ_MODE_RULES, /Mən sadəcə süni intellektəm/);
  assert.match(LOCAL_AZ_MODE_RULES, /iki alternativ yolumuz var: A və B/);

  // Preserves existing local laws
  assert.match(LOCAL_AZ_MODE_RULES, /İstehlakçı Psixologiyası və Satış Vərdişləri/);
  assert.match(LOCAL_AZ_MODE_RULES, /Instagram/);
  assert.match(LOCAL_AZ_MODE_RULES, /TikTok/);
  assert.match(LOCAL_AZ_MODE_RULES, /VÖEN/);
  assert.match(LOCAL_AZ_MODE_RULES, /MMC/);
  assert.match(LOCAL_AZ_MODE_RULES, /İlk 7 gün/);
  assert.match(LOCAL_AZ_MODE_RULES, /İlk 30 gün/);
});

test("6. buildStrategyPrompt, buildAssessorPrompt, and buildRefinementPrompt assemble prompts with market directives and calibration", () => {
  const azStrategy = buildStrategyPrompt({ brief: "Bakıda kafe açırıq" });
  assert.match(azStrategy, /\[MARKET CONTEXT DIRECTIVE: Target market is detected as AZERBAIJAN/);
  assert.match(azStrategy, /EPISTEMIC HUMILITY/i);
  assert.match(azStrategy, /aylıq 4,820 AZN/);

  const globalStrategy = buildStrategyPrompt({ brief: "SaaS platform in USA" });
  assert.match(globalStrategy, /\[MARKET CONTEXT DIRECTIVE: Target market is detected as GLOBAL \/ INTERNATIONAL/);
  assert.match(globalStrategy, /EPISTEMIC HUMILITY/i);

  const azAssessor = buildAssessorPrompt({ brief: "Bakı brendi" });
  assert.match(azAssessor, /Epistemic Humility/i);

  const azRefinement = buildRefinementPrompt({ brief: "Bakı brendi" });
  assert.match(azRefinement, /EPISTEMIC HUMILITY/i);
});

test("7. Ask Mode: ASK_INSTRUCTIONS and buildAskPrompt integrate epistemic humility and proactive solutions", () => {
  assert.match(ASK_INSTRUCTIONS, /You are Helmer Ask/);
  assert.match(ASK_INSTRUCTIONS, /EPISTEMIC HUMILITY/i);
  assert.match(ASK_INSTRUCTIONS, /Bu sahə üzrə dəqiq rəsmi statistika əlimizdə yoxdur/);
  assert.match(ASK_INSTRUCTIONS, /aylıq 4,820 AZN/);
  assert.match(ASK_INSTRUCTIONS, /Bunu dəqiqləşdirmək lazımdır, amma gələn nəticəyə görə iki alternativ yolumuz var: A və B/);

  const promptWithContext = buildAskPrompt({
    strategyContext: "\n<context>Strategy</context>",
    taskContext: "\n<task>Task 1</task>",
    personalizationContext: "\n<user>Personal</user>",
  });

  assert.match(promptWithContext, /You are Helmer Ask/);
  assert.match(promptWithContext, /<context>Strategy<\/context>/);
  assert.match(promptWithContext, /<task>Task 1<\/task>/);
  assert.match(promptWithContext, /<user>Personal<\/user>/);
  assert.match(promptWithContext, /EPISTEMIC HUMILITY/i);
});

test("8. server.js imports ASK_INSTRUCTIONS, buildAskPrompt and wires epistemic humility into search guidance", async () => {
  const serverCode = await fs.readFile(path.join(process.cwd(), "server.js"), "utf8");

  // Imports calibration utilities
  assert.match(serverCode, /import\s*\{[^}]*ASK_INSTRUCTIONS[^}]*\}\s*from\s*"\.\/src\/services\/ai\/prompts\.js"/);
  assert.match(serverCode, /import\s*\{[^}]*buildAskPrompt[^}]*\}\s*from\s*"\.\/src\/services\/ai\/prompts\.js"/);

  // Wires buildAskPrompt in request handling
  assert.match(serverCode, /buildAskPrompt\(\{/);

  // Search guidance includes epistemic humility & proactive leadership
  assert.match(serverCode, /EPISTEMIC HUMILITY, ACCURACY & PROACTIVE LEADERSHIP/);
  assert.match(serverCode, /NEVER hallucinate an invented number or feign certainty/);
  assert.match(serverCode, /Never give a dead-end refusal or stop at "bilmirəm"/);
});
