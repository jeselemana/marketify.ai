import { createHash } from "node:crypto";
import {
  StrategyAssessmentSchema,
  StrategySchema,
  analyzeBriefSignals,
  validateAssessment,
} from "../../domain/strategy.js";
import { aiConfig } from "./config.js";
import { openBuildStrategyStream, openBuildStructuredStream } from "./provider-router.js";
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

async function parseRoutedStructured({
  selectedModel,
  schema,
  name,
  instructions,
  input,
  maxOutputTokens,
  temperature = 0.6,
  thinkingBudget = 0,
  reasoningEffort = "medium",
  ownerId,
  signal,
}) {
  const upstream = await openBuildStructuredStream({
    selectedModel,
    instructions,
    input,
    schema,
    schemaName: name,
    maxOutputTokens,
    temperature,
    thinkingBudget,
    reasoningEffort,
    ownerId: privacySafeIdentifier(ownerId),
    signal,
  });
  let text = "";
  let finishReason = "stop";
  for await (const event of upstream.events) {
    if (event.type === "delta") text += event.delta;
    if (event.type === "done") finishReason = event.finishReason || "stop";
  }
  if (["max_output_tokens", "max_tokens"].includes(finishReason)) {
    const error = new Error("Model çıxış limitinə çatdı.");
    error.code = "AI_MAX_TOKENS";
    error.status = 409;
    throw error;
  }
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return schema.parse(JSON.parse(cleaned));
  } catch (cause) {
    const error = new Error("AI cavabının strukturu doğrulanmadı.", { cause });
    error.code = "AI_INVALID_OUTPUT";
    throw error;
  }
}

export async function assessBrief({ brief, answers, round, selectedModel, ownerId, signal, personalizationContext = "" }) {
  const signals = analyzeBriefSignals(brief);
  const forceDecision = round >= aiConfig.maxClarificationRounds;
  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake signals (advisory only):\n${JSON.stringify(signals)}\n\nClarification round: ${round} of ${aiConfig.maxClarificationRounds}.\n${
    forceDecision
      ? "The clarification limit has been reached. Return ready and clearly state reasonable assumptions unless the business itself or objective is impossible to identify."
      : "Decide whether a targeted clarification round is materially useful."
  }`;

  const parsed = await parseRoutedStructured({
    selectedModel,
    schema: StrategyAssessmentSchema,
    name: "strategy_assessment",
    instructions: `${ASSESSOR_PROMPT}${personalizationContext || ""}`,
    input,
    maxOutputTokens: aiConfig.assessmentMaxOutputTokens,
    temperature: 0.6,
    thinkingBudget: 0,
    reasoningEffort: "low",
    ownerId,
    signal,
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

export function streamStrategy({
  brief,
  answers,
  assumptions,
  continuation,
  selectedModel,
  ownerId,
  signal,
  personalizationContext = "",
}) {
  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake assumptions:\n${
    assumptions.length ? assumptions.join("\n- ") : "None supplied."
  }${continuation ? `\n\nA previous response reached its output limit. Return one complete valid strategy JSON object, preserving useful completed work and finishing every required field. Previous partial response:\n<partial_response>\n${continuation}\n</partial_response>` : ""}`;

  return openBuildStrategyStream({
    selectedModel,
    instructions: `${STRATEGY_PROMPT}${personalizationContext || ""}`,
    input,
    ownerId: privacySafeIdentifier(ownerId),
    signal,
  });
}

export async function refineStrategy(payload, ownerId, signal, personalizationContext = "") {
  return parseRoutedStructured({
    selectedModel: payload.selectedModel,
    schema: StrategySchema,
    name: "marketify_refined_strategy",
    instructions: `${REFINEMENT_PROMPT}${personalizationContext || ""}`,
    input: buildRefinementInput(payload),
    maxOutputTokens: aiConfig.refinementMaxOutputTokens,
    thinkingBudget: payload.action === "think_deeper" ? 512 : 0,
    reasoningEffort: payload.action === "think_deeper" ? "high" : "medium",
    ownerId,
    signal,
  });
}
