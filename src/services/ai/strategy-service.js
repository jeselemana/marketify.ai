import {
  StrategyAssessmentSchema,
  StrategySchema,
  analyzeBriefSignals,
  validateAssessment,
} from "../../domain/strategy.js";
import { aiConfig } from "./config.js";
import { routeStructuredGeneration } from "./llm-router.js";
import {
  ASSESSOR_PROMPT,
  REFINEMENT_PROMPT,
  STRATEGY_PROMPT,
  buildRefinementInput,
} from "./prompts.js";

function clarificationContext(answers) {
  if (!answers?.length) return "No clarification answers have been provided.";
  return answers.map((item) => `${item.question}\nAnswer: ${item.answer}`).join("\n\n");
}

export async function assessBrief({
  brief,
  answers = [],
  round = 0,
  language = "az",
  ownerId,
  signal,
  personalizationContext = "",
  onChunk,
  onUsage,
}) {
  const isEn = language === "en";
  const signals = analyzeBriefSignals(brief);
  const forceDecision = round >= aiConfig.maxClarificationRounds;
  const languageDirective = isEn
    ? "IMPORTANT LANGUAGE REQUIREMENT: The user has selected ENGLISH as the UI language. All generated outputs (understanding, every question, reason, options, and assumptions) MUST BE WRITTEN IN ENGLISH, even if the brief is in Azerbaijani or discusses Azerbaijani topics."
    : "DİL TƏLƏBİ: İstifadəçinin interfeys dili AZƏRBAYCAN dilidir. Bütün suallar, səbəblər, seçimlər və fərziyyələr Azərbaycan dilində formalaşdırılmalıdır.";

  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake signals (advisory only):\n${JSON.stringify(signals)}\n\nClarification round: ${round} of ${aiConfig.maxClarificationRounds}.\n${
    forceDecision
      ? (isEn
          ? "The clarification limit has been reached. Return ready and clearly state reasonable assumptions in English unless the business itself or objective is impossible to identify."
          : "The clarification limit has been reached. Return ready and clearly state reasonable assumptions unless the business itself or objective is impossible to identify.")
      : (isEn
          ? "Decide whether a targeted clarification round is materially useful. All questions and options must be in English."
          : "Decide whether a targeted clarification round is materially useful.")
  }\n\n${languageDirective}`;

  const result = await routeStructuredGeneration({
    schema: StrategyAssessmentSchema,
    name: "strategy_assessment",
    instructions: `${ASSESSOR_PROMPT}${personalizationContext || ""}`,
    input,
    maxOutputTokens: aiConfig.assessmentMaxOutputTokens,
    reasoning: "low",
    ownerId,
    signal,
    onChunk,
    onUsage,
  });

  const assessment = validateAssessment(result.data);
  if (forceDecision && assessment.status === "needs_clarification") {
    return {
      status: "ready",
      understanding: assessment.understanding,
      questions: [],
      assumptions: [
        isEn
          ? "Some intake details were not provided, so the strategy proceeds with clearly labeled working assumptions."
          : "Bəzi ilkin detallar təqdim edilmədiyi üçün strategiya aydın qeyd edilmiş işçi fərziyyələrlə davam edir.",
      ],
      model: result.model,
    };
  }
  return { ...assessment, model: result.model };
}

export async function generateStrategy({
  brief,
  answers = [],
  assumptions = [],
  language = "az",
  ownerId,
  signal,
  personalizationContext = "",
  onChunk,
  onUsage,
}) {
  const isEn = language === "en";
  const languageDirective = isEn
    ? "\n\nLanguage Directive: The user has selected English. Generate the entire strategy in clear, professional English."
    : "\n\nLanguage Directive: Strategiyanı təmiz, peşəkar Azərbaycan dilində hazırla.";

  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake assumptions:\n${
    assumptions.length ? assumptions.join("\n- ") : "None supplied."
  }${languageDirective}`;

  const result = await routeStructuredGeneration({
    schema: StrategySchema,
    name: "helmer_strategy",
    instructions: `${STRATEGY_PROMPT}${personalizationContext || ""}`,
    input,
    maxOutputTokens: aiConfig.strategyMaxOutputTokens,
    reasoning: "medium",
    ownerId,
    signal,
    onChunk,
    onUsage,
  });

  return result.data;
}

export async function refineStrategy(payload, ownerId, signal, personalizationContext = "", onChunk, onUsage) {
  const isEn = payload.language === "en";
  const languageDirective = isEn
    ? "\n\nLanguage Directive: The user has selected English. Maintain and output the refined strategy in professional English."
    : "";

  const result = await routeStructuredGeneration({
    schema: StrategySchema,
    name: "helmer_refined_strategy",
    instructions: `${REFINEMENT_PROMPT}${personalizationContext || ""}`,
    input: `${buildRefinementInput(payload)}${languageDirective}`,
    maxOutputTokens: aiConfig.refinementMaxOutputTokens,
    reasoning: payload.action === "think_deeper" ? "high" : "medium",
    ownerId,
    signal,
    onChunk,
    onUsage,
  });

  return result.data;
}
