import { createHash } from "node:crypto";
import { zodTextFormat } from "openai/helpers/zod";
import {
  StrategyAssessmentSchema,
  StrategySchema,
  analyzeBriefSignals,
  validateAssessment,
} from "../../domain/strategy.js";
import { executeGeminiGenerate, getOpenAIClient } from "./client.js";
import { aiConfig, getAIProvider, resolveAIModel } from "./config.js";
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

function schemaGuide(name) {
  if (name === "strategy_assessment") {
    return `
Output must be a raw JSON object with this exact schema:
{
  "status": "needs_clarification" | "ready",
  "understanding": "string",
  "questions": [
    {
      "id": "snake_case_string",
      "question": "string",
      "reason": "string",
      "inputType": "single_choice" | "multi_choice" | "text",
      "options": ["string"]
    }
  ],
  "assumptions": ["string"]
}
`;
  }
  if (name === "marketify_strategy" || name === "marketify_refined_strategy") {
    return `
Output must be a raw JSON object with this exact schema:
{
  "title": "string",
  "summary": "string",
  "context": {
    "business": "string",
    "objective": "string",
    "market": "string",
    "targetAudience": "string"
  },
  "sections": [
    {
      "id": "snake_case_string",
      "title": "string",
      "summary": "string",
      "content": "string",
      "bullets": ["string"]
    }
  ],
  "priorities": [
    {
      "title": "string",
      "description": "string",
      "priority": "high" | "medium" | "low"
    }
  ],
  "actionPlan": [
    {
      "phase": "string",
      "actions": ["string"],
      "expectedOutcome": "string"
    }
  ],
  "kpis": [
    {
      "name": "string",
      "reason": "string",
      "target": "string"
    }
  ],
  "risks": [
    {
      "risk": "string",
      "mitigation": "string"
    }
  ],
  "assumptions": ["string"],
  "nextSteps": ["string"]
}
`;
  }
  return "";
}

async function parseStructured({ selectedModel = "flash", schema, name, instructions, input, maxOutputTokens, reasoning, ownerId, signal }) {
  const { provider, model } = resolveAIModel({ mode: "build", selectedModel });

  if (provider === "gemini") {
    try {
      const systemInstruction = `${instructions}\n\n${schemaGuide(name)}\n\nIMPORTANT: Return pure valid JSON only without markdown formatting or backticks.`;
      const rawText = await executeGeminiGenerate({
        model,
        systemInstruction,
        prompt: input,
        responseFormat: "application/json",
        temperature: 0.2,
        maxOutputTokens,
        signal,
      });

      let cleanText = (rawText || "").trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/^```json\s*/, "").replace(/```$/, "").trim();
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```\s*/, "").replace(/```$/, "").trim();
      }

      let parsed;
      try {
        parsed = JSON.parse(cleanText);
      } catch (parseError) {
        console.error("Gemini JSON parse failed:", parseError, "Raw text:", cleanText.slice(0, 300));
        const error = new Error("The AI response could not be parsed as JSON.");
        error.code = "AI_INVALID_OUTPUT";
        throw error;
      }

      // Auto-repair minor array structures if omitted
      if (name === "marketify_strategy" || name === "marketify_refined_strategy") {
        if (Array.isArray(parsed.sections)) {
          parsed.sections = parsed.sections.map((sec, idx) => ({
            id: sec.id || `section_${idx + 1}`,
            title: sec.title || `Bölmə ${idx + 1}`,
            summary: sec.summary || "",
            content: sec.content || "",
            bullets: Array.isArray(sec.bullets) ? sec.bullets : [],
          }));
        }
        if (!Array.isArray(parsed.assumptions)) parsed.assumptions = [];
        if (!Array.isArray(parsed.risks)) parsed.risks = [];
        if (!Array.isArray(parsed.nextSteps)) parsed.nextSteps = ["Strategiyanı nəzərdən keçirmək"];
      }

      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        console.error("Gemini schema validation failed:", JSON.stringify(validated.error.issues, null, 2));
        const error = new Error("The AI response could not be validated.");
        error.code = "AI_INVALID_OUTPUT";
        error.details = validated.error.issues;
        throw error;
      }

      return validated.data;
    } catch (geminiError) {
      if (process.env.OPENAI_API_KEY) {
        console.warn("[AI Provider] Gemini error, falling back to OpenAI:", geminiError.message);
        // Fallback to OpenAI
      } else {
        throw geminiError;
      }
    }
  }

  // OpenAI Provider (primary or fallback)
  const openAIModel = aiConfig.openAIBaseStrategyModel || "gpt-5.6-terra";
  const requestOptions = signal ? { signal } : undefined;
  const response = await getOpenAIClient().responses.parse(
    {
      model: openAIModel,
      instructions,
      input,
      text: { format: zodTextFormat(schema, name) },
      reasoning: { effort: reasoning },
      max_output_tokens: maxOutputTokens,
      safety_identifier: privacySafeIdentifier(ownerId),
    },
    requestOptions,
  );

  if (!response.output_parsed) {
    const error = new Error("The AI response could not be validated.");
    error.code = "AI_INVALID_OUTPUT";
    throw error;
  }

  return response.output_parsed;
}

export async function assessBrief({ brief, answers, round, model: selectedModel, ownerId, signal }) {
  const signals = analyzeBriefSignals(brief);
  const forceDecision = round >= aiConfig.maxClarificationRounds;
  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake signals (advisory only):\n${JSON.stringify(signals)}\n\nClarification round: ${round} of ${aiConfig.maxClarificationRounds}.\n${
    forceDecision
      ? "The clarification limit has been reached. Return ready and clearly state reasonable assumptions unless the business itself or objective is impossible to identify."
      : "Decide whether a targeted clarification round is materially useful."
  }`;

  const parsed = await parseStructured({
    selectedModel,
    schema: StrategyAssessmentSchema,
    name: "strategy_assessment",
    instructions: ASSESSOR_PROMPT,
    input,
    maxOutputTokens: aiConfig.assessmentMaxOutputTokens,
    reasoning: "low",
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

export async function generateStrategy({ brief, answers, assumptions, model: selectedModel, ownerId, signal }) {
  const input = `Original brief:\n${brief}\n\nClarification answers:\n${clarificationContext(answers)}\n\nIntake assumptions:\n${
    assumptions.length ? assumptions.join("\n- ") : "None supplied."
  }`;

  return parseStructured({
    selectedModel,
    schema: StrategySchema,
    name: "marketify_strategy",
    instructions: STRATEGY_PROMPT,
    input,
    maxOutputTokens: aiConfig.strategyMaxOutputTokens,
    reasoning: "medium",
    ownerId,
    signal,
  });
}

export async function refineStrategy(payload, ownerId, signal) {
  return parseStructured({
    selectedModel: payload.model,
    schema: StrategySchema,
    name: "marketify_refined_strategy",
    instructions: REFINEMENT_PROMPT,
    input: buildRefinementInput(payload),
    maxOutputTokens: aiConfig.refinementMaxOutputTokens,
    reasoning: payload.action === "think_deeper" ? "high" : "medium",
    ownerId,
    signal,
  });
}
