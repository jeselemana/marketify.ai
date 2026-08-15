import { createHash } from "node:crypto";
import { zodTextFormat } from "openai/helpers/zod";
import {
  StrategyAssessmentSchema,
  StrategySchema,
  analyzeBriefSignals,
  validateAssessment,
} from "../../domain/strategy.js";
import { getOpenAIClient } from "./client.js";
import { aiConfig } from "./config.js";
import {
  ASSESSOR_PROMPT,
  REFINEMENT_PROMPT,
  STRATEGY_PROMPT,
  buildRefinementInput,
} from "./prompts.js";

function privacySafeIdentifier(ownerId) {
  return createHash("sha256").update(ownerId).digest("hex").slice(0, 32);
}

function clarificationContext(answers) {
  if (!answers.length) return "No clarification answers have been provided.";
  return answers.map((item) => `${item.question}\nAnswer: ${item.answer}`).join("\n\n");
}

async function parseStructured({ model, schema, name, instructions, input, maxOutputTokens, reasoning, ownerId }) {
  const response = await getOpenAIClient().responses.parse({
    model,
    instructions,
    input,
    text: { format: zodTextFormat(schema, name) },
    reasoning: { effort: reasoning },
    max_output_tokens: maxOutputTokens,
    safety_identifier: privacySafeIdentifier(ownerId),
  });

  if (!response.output_parsed) {
    const error = new Error("The AI response could not be validated.");
    error.code = "AI_INVALID_OUTPUT";
    throw error;
  }

  return response.output_parsed;
}

export async function assessBrief({ brief, answers, round, ownerId }) {
  const signals = analyzeBriefSignals(brief);
  const forceDecision = round >= aiConfig.maxClarificationRounds;
  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake signals (advisory only):\n${JSON.stringify(signals)}\n\nClarification round: ${round} of ${aiConfig.maxClarificationRounds}.\n${
    forceDecision
      ? "The clarification limit has been reached. Return ready and clearly state reasonable assumptions unless the business itself or objective is impossible to identify."
      : "Decide whether a targeted clarification round is materially useful."
  }`;

  const parsed = await parseStructured({
    model: aiConfig.fastModel,
    schema: StrategyAssessmentSchema,
    name: "strategy_assessment",
    instructions: ASSESSOR_PROMPT,
    input,
    maxOutputTokens: aiConfig.assessmentMaxOutputTokens,
    reasoning: "low",
    ownerId,
  });

  const assessment = validateAssessment(parsed);
  if (forceDecision && assessment.status === "needs_clarification") {
    return {
      status: "ready",
      understanding: assessment.understanding,
      questions: [],
      assumptions: [
        "Some intake details were not provided, so the strategy proceeds with clearly labeled working assumptions.",
      ],
    };
  }
  return assessment;
}

export async function generateStrategy({ brief, answers, assumptions, ownerId }) {
  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake assumptions:\n${
    assumptions.length ? assumptions.join("\n- ") : "None supplied."
  }`;

  return parseStructured({
    model: aiConfig.strategyModel,
    schema: StrategySchema,
    name: "marketify_strategy",
    instructions: STRATEGY_PROMPT,
    input,
    maxOutputTokens: aiConfig.strategyMaxOutputTokens,
    reasoning: "medium",
    ownerId,
  });
}

export async function refineStrategy(payload, ownerId) {
  return parseStructured({
    model: aiConfig.strategyModel,
    schema: StrategySchema,
    name: "marketify_refined_strategy",
    instructions: REFINEMENT_PROMPT,
    input: buildRefinementInput(payload),
    maxOutputTokens: aiConfig.refinementMaxOutputTokens,
    reasoning: payload.action === "think_deeper" ? "high" : "medium",
    ownerId,
  });
}
