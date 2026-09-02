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
  ownerId,
  signal,
  personalizationContext = "",
  onChunk,
  onUsage,
}) {
  const signals = analyzeBriefSignals(brief);
  const forceDecision = round >= aiConfig.maxClarificationRounds;
  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake signals (advisory only):\n${JSON.stringify(signals)}\n\nClarification round: ${round} of ${aiConfig.maxClarificationRounds}.\n${
    forceDecision
      ? "The clarification limit has been reached. Return ready and clearly state reasonable assumptions unless the business itself or objective is impossible to identify."
      : "Decide whether a targeted clarification round is materially useful."
  }`;

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
        "Some intake details were not provided, so the strategy proceeds with clearly labeled working assumptions.",
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
  ownerId,
  signal,
  personalizationContext = "",
  onChunk,
  onUsage,
}) {
  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake assumptions:\n${
    assumptions.length ? assumptions.join("\n- ") : "None supplied."
  }`;

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
  const result = await routeStructuredGeneration({
    schema: StrategySchema,
    name: "helmer_refined_strategy",
    instructions: `${REFINEMENT_PROMPT}${personalizationContext || ""}`,
    input: buildRefinementInput(payload),
    maxOutputTokens: aiConfig.refinementMaxOutputTokens,
    reasoning: payload.action === "think_deeper" ? "high" : "medium",
    ownerId,
    signal,
    onChunk,
    onUsage,
  });

  return result.data;
}
