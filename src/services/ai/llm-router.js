import { createHash } from "node:crypto";
import { zodTextFormat } from "openai/helpers/zod";
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

export async function streamOpenAIContent({ model = aiConfig.strategyModel, instructions, input, onChunk, onUsage, ownerId, signal, maxOutputTokens = aiConfig.strategyMaxOutputTokens, reasoning = "medium" }) {
  if (!hasOpenAIConfiguration()) {
    throw new LLMProviderError("OpenAI xidməti hələ konfiqurasiya edilməyib. OPENAI_API_KEY əlavə et və yenidən yoxla.", { code: "AI_NOT_CONFIGURED", status: 503, model, provider: "openai" });
  }
  try {
    const stream = await getOpenAIClient().chat.completions.create({
      model,
      messages: [...(instructions ? [{ role: "system", content: instructions }] : []), { role: "user", content: input }],
      stream: true,
      max_completion_tokens: maxOutputTokens,
      reasoning_effort: reasoning,
      user: privacySafeIdentifier(ownerId),
    }, signal ? { signal } : undefined);
    let text = "";
    let finishReason = null;
    let usage = null;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      finishReason = chunk.choices?.[0]?.finish_reason || finishReason;
      usage = chunk.usage || usage;
      if (delta) {
        text += delta;
        onChunk?.({ chunk: delta, finishReason, model });
      }
    }
    onUsage?.({ usage, model, provider: "openai" });
    return { text, finishReason: finishReason || "STOP", model, provider: "openai", usage };
  } catch (error) {
    if (error.name === "AbortError" || signal?.aborted) throw error;
    throw new LLMProviderError(`OpenAI xidməti ilə əlaqə qurmaq mümkün olmadı: ${error.message}`, { code: "AI_PROVIDER_ERROR", status: error.status || 503, model, provider: "openai", details: error });
  }
}

export async function routeStructuredGeneration({ schema, name, instructions, input, maxOutputTokens, reasoning = "medium", ownerId, signal, onChunk, onUsage }) {
  if (!hasOpenAIConfiguration()) {
    throw new LLMProviderError("OpenAI xidməti hələ konfiqurasiya edilməyib. OPENAI_API_KEY əlavə et və yenidən yoxla.", {
      code: "AI_NOT_CONFIGURED",
      status: 503,
      model: aiConfig.strategyModel,
      provider: "openai",
    });
  }

  try {
    const response = await getOpenAIClient().responses.parse(
      {
        model: aiConfig.strategyModel,
        instructions,
        input,
        text: { format: zodTextFormat(schema, name) },
        reasoning: { effort: reasoning },
        max_output_tokens: maxOutputTokens || aiConfig.strategyMaxOutputTokens,
        safety_identifier: privacySafeIdentifier(ownerId),
      },
      signal ? { signal } : undefined,
    );

    if (!response.output_parsed) {
      throw new LLMProviderError("OpenAI cavabı doğrulana bilmədi.", {
        code: "AI_INVALID_OUTPUT",
        status: 502,
        model: aiConfig.strategyModel,
        provider: "openai",
        details: response,
      });
    }

    const data = schema.parse(normalizeStructuredOutput(response.output_parsed, name));
    const rawText = JSON.stringify(data);
    onChunk?.({ chunk: rawText, finishReason: "STOP", model: aiConfig.strategyModel });
    onUsage?.({ usage: response.usage || null, model: aiConfig.strategyModel, provider: "openai" });

    return {
      data,
      model: aiConfig.strategyModel,
      provider: "openai",
      usage: response.usage || null,
      finishReason: "STOP",
      rawText,
    };
  } catch (error) {
    if (error instanceof LLMProviderError) throw error;
    if (error.name === "AbortError" || signal?.aborted) throw error;

    const httpStatus = error.status || 500;
    if (httpStatus === 429 || error.code === "rate_limit_exceeded") {
      throw new LLMProviderError("GPT-5.6 Terra xidmətində sorğu limiti aşılıb (429). Zəhmət olmasa bir az sonra yenidən cəhd edin.", {
        code: "AI_RATE_LIMITED",
        status: 429,
        model: aiConfig.strategyModel,
        provider: "openai",
        details: error,
      });
    }

    throw new LLMProviderError(`OpenAI generasiya xətası: ${error.message}`, {
      code: error.code || "AI_PROVIDER_ERROR",
      status: httpStatus >= 500 ? 503 : httpStatus,
      model: aiConfig.strategyModel,
      provider: "openai",
      details: error,
    });
  }
}
