import { createHash } from "node:crypto";
import { getOpenAIClient } from "./client.js";
import { aiConfig, hasOpenAIConfiguration } from "./config.js";

export class LLMProviderError extends Error {
  constructor(message, { code = "AI_PROVIDER_ERROR", status = 502, model, provider, details = null } = {}) {
    super(message);
    this.name = "LLMProviderError";
    this.code = code;
    this.status = status;
    this.model = model;
    this.provider = provider;
    this.details = details;
  }
}

function privacySafeIdentifier(ownerId) {
  return ownerId ? createHash("sha256").update(String(ownerId)).digest("hex").slice(0, 32) : undefined;
}

function normalizeStructuredOutput(parsed, name) {
  if (!parsed || typeof parsed !== "object" || name !== "strategy_assessment") return parsed;
  if (parsed.status === "clarification_needed") parsed.status = "needs_clarification";
  if (!parsed.understanding || typeof parsed.understanding !== "string") parsed.understanding = "Brif analiz edildi və strateji istiqamətlər müəyyənləşdirildi.";
  parsed.questions = Array.isArray(parsed.questions)
    ? parsed.questions.map((question, index) => ({
        id: question.id || `q_${index + 1}`,
        question: question.question || "Əlavə detal",
        reason: question.reason || "",
        inputType: ["single_choice", "multi_choice", "text"].includes(question.inputType) ? question.inputType : "single_choice",
        options: Array.isArray(question.options) ? question.options : [],
      }))
    : [];
  if (!Array.isArray(parsed.assumptions)) parsed.assumptions = [];
  return parsed;
}

export async function streamOpenAIContent({ model = aiConfig.strategyModel, instructions, input, onChunk, ownerId, signal, maxOutputTokens = aiConfig.strategyMaxOutputTokens, reasoning = "medium" }) {
  if (!hasOpenAIConfiguration()) {
    throw new LLMProviderError("OpenAI xidməti hələ konfiqurasiya edilməyib. OPENAI_API_KEY əlavə et və yenidən yoxla.", { code: "AI_NOT_CONFIGURED", status: 503, model, provider: "openai" });
  }
  try {
    const stream = await getOpenAIClient().chat.completions.create({
      model,
      messages: [...(instructions ? [{ role: "system", content: instructions }] : []), { role: "user", content: input }],
      stream: true,
      max_tokens: maxOutputTokens,
      reasoning_effort: reasoning,
      user: privacySafeIdentifier(ownerId),
    }, signal ? { signal } : undefined);
    let text = "";
    let finishReason = null;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      finishReason = chunk.choices?.[0]?.finish_reason || finishReason;
      if (delta) {
        text += delta;
        onChunk?.({ chunk: delta, finishReason, model });
      }
    }
    return { text, finishReason: finishReason || "STOP", model, provider: "openai" };
  } catch (error) {
    if (error.name === "AbortError" || signal?.aborted) throw error;
    throw new LLMProviderError(`OpenAI xidməti ilə əlaqə qurmaq mümkün olmadı: ${error.message}`, { code: "AI_PROVIDER_ERROR", status: error.status || 503, model, provider: "openai", details: error });
  }
}

export async function routeStructuredGeneration({ schema, name, instructions, input, maxOutputTokens, reasoning = "medium", ownerId, signal, onChunk }) {
  const result = await streamOpenAIContent({
    model: aiConfig.strategyModel,
    instructions: `${instructions}\n\nYou MUST return valid JSON adhering to the ${name} schema.`,
    input,
    onChunk,
    ownerId,
    signal,
    maxOutputTokens: maxOutputTokens || aiConfig.strategyMaxOutputTokens,
    reasoning,
  });
  const rawText = result.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  try {
    return { data: schema.parse(normalizeStructuredOutput(JSON.parse(rawText), name)), model: result.model, finishReason: result.finishReason, rawText: result.text };
  } catch (error) {
    const isTruncated = result.finishReason === "length" || result.finishReason === "MAX_TOKENS";
    const providerError = new LLMProviderError(isTruncated ? "Strategiya generasiyası token limitinə görə yarımçıq qaldı." : `Model çıxışı JSON sxeminə uyğun deyil: ${error.message}`, {
      code: isTruncated ? "AI_MAX_TOKENS" : "AI_INVALID_OUTPUT",
      status: isTruncated ? 422 : 502,
      model: result.model,
      provider: "openai",
      details: { rawText: result.text, parseError: error.message },
    });
    if (isTruncated) providerError.partialText = result.text;
    throw providerError;
  }
}
