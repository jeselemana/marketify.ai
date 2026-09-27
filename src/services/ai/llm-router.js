import { createHash } from "node:crypto";
import { zodTextFormat, zodResponseFormat } from "openai/helpers/zod";
import { getGeminiClient, getOpenAIClient } from "./client.js";
import { aiConfig, hasGeminiConfiguration, hasOpenAIConfiguration } from "./config.js";

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

export function formatGeminiResponseSchema(schema, name) {
  const jsonFormat = zodResponseFormat(schema, name);
  const rawSchema = jsonFormat.json_schema?.schema || jsonFormat;
  const definitions = rawSchema.definitions || {};

  function resolve(obj) {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(resolve);
    if ("$ref" in obj) {
      const refKey = String(obj["$ref"]).replace("#/definitions/", "");
      if (definitions[refKey]) {
        return resolve(JSON.parse(JSON.stringify(definitions[refKey])));
      }
    }
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "properties" && v && typeof v === "object") {
        res.properties = {};
        for (const [propName, propVal] of Object.entries(v)) {
          res.properties[propName] = resolve(propVal);
        }
      } else if (k === "items" && v && typeof v === "object") {
        res.items = resolve(v);
      } else if (["type", "required", "enum", "description", "nullable"].includes(k)) {
        res[k] = Array.isArray(v) ? [...v] : v;
      }
    }
    return res;
  }

  return resolve(rawSchema);
}

export async function streamOpenAIContent({ model = aiConfig.strategyFallbackModel || "gpt-5.6-terra", instructions, input, onChunk, onUsage, ownerId, signal, maxOutputTokens = aiConfig.strategyMaxOutputTokens, reasoning = "medium" }) {
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

async function tryGenerateWithOpenAI({ model, schema, name, instructions, input, maxOutputTokens, reasoning = "medium", ownerId, signal, onChunk, onUsage }) {
  try {
    const response = await getOpenAIClient().responses.parse(
      {
        model,
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
      throw new LLMProviderError(`OpenAI (${model}) cavabı doğrulana bilmədi.`, {
        code: "AI_INVALID_OUTPUT",
        status: 502,
        model,
        provider: "openai",
        details: response,
      });
    }

    const data = schema.parse(normalizeStructuredOutput(response.output_parsed, name));
    const rawText = JSON.stringify(data);
    onChunk?.({ chunk: rawText, finishReason: "STOP", model });
    onUsage?.({ usage: response.usage || null, model, provider: "openai" });

    return {
      data,
      model,
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
      throw new LLMProviderError(`OpenAI (${model}) xidmətində sorğu limiti aşılıb (429). Zəhmət olmasa bir az sonra yenidən cəhd edin.`, {
        code: "AI_RATE_LIMITED",
        status: 429,
        model,
        provider: "openai",
        details: error,
      });
    }

    throw new LLMProviderError(`OpenAI generasiya xətası: ${error.message}`, {
      code: error.code || "AI_PROVIDER_ERROR",
      status: httpStatus >= 500 ? 503 : httpStatus,
      model,
      provider: "openai",
      details: error,
    });
  }
}

async function tryGenerateWithGemini({ model, schema, name, instructions, input, maxOutputTokens, signal, onChunk, onUsage }) {
  try {
    const gemini = getGeminiClient();
    const geminiSchema = formatGeminiResponseSchema(schema, name);

    const response = await gemini.models.generateContent(
      {
        model,
        contents: input,
        config: {
          systemInstruction: instructions || undefined,
          responseMimeType: "application/json",
          responseSchema: geminiSchema,
          maxOutputTokens: maxOutputTokens || aiConfig.strategyMaxOutputTokens,
          thinkingConfig: {
            thinkingLevel: aiConfig.strategyThinkingLevel || "HIGH",
          },
        },
      },
      signal ? { signal } : undefined,
    );

    const rawText = response.text?.trim() || "";
    if (!rawText) {
      throw new LLMProviderError(`Gemini (${model}) boş cavab qaytardı.`, {
        code: "AI_INVALID_OUTPUT",
        status: 502,
        model,
        provider: "google",
        details: response,
      });
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (parseError) {
      throw new LLMProviderError(`Gemini (${model}) JSON formatı etibarsızdır.`, {
        code: "AI_INVALID_OUTPUT",
        status: 502,
        model,
        provider: "google",
        details: parseError,
      });
    }

    const data = schema.parse(normalizeStructuredOutput(parsedJson, name));
    const finalRawText = JSON.stringify(data);

    let usage = null;
    if (response.usageMetadata) {
      usage = {
        prompt_tokens: response.usageMetadata.promptTokenCount || null,
        completion_tokens: response.usageMetadata.candidatesTokenCount || null,
        total_tokens: response.usageMetadata.totalTokenCount || null,
      };
    }

    onChunk?.({ chunk: finalRawText, finishReason: "STOP", model });
    onUsage?.({ usage, model, provider: "google" });

    return {
      data,
      model,
      provider: "google",
      usage,
      finishReason: "STOP",
      rawText: finalRawText,
    };
  } catch (geminiError) {
    if (geminiError instanceof LLMProviderError) throw geminiError;
    if (geminiError.name === "AbortError" || signal?.aborted) throw geminiError;

    throw new LLMProviderError(`Gemini generasiya xətası: ${geminiError.message}`, {
      code: geminiError.code || "AI_PROVIDER_ERROR",
      status: geminiError.status || 503,
      model,
      provider: "google",
      details: geminiError,
    });
  }
}

export async function routeStructuredGeneration({ schema, name, instructions, input, maxOutputTokens, reasoning = "medium", ownerId, signal, onChunk, onUsage }) {
  const primaryModel = aiConfig.strategyModel;
  const fallbackModel = aiConfig.strategyFallbackModel || "gemini-3.8-flash";
  const isPrimaryOpenAI = !primaryModel.startsWith("gemini");

  if (isPrimaryOpenAI) {
    // 1. Primary: Try OpenAI (gpt-6-astra)
    if (hasOpenAIConfiguration()) {
      try {
        return await tryGenerateWithOpenAI({
          model: primaryModel,
          schema,
          name,
          instructions,
          input,
          maxOutputTokens,
          reasoning,
          ownerId,
          signal,
          onChunk,
          onUsage,
        });
      } catch (primaryErr) {
        if (primaryErr.name === "AbortError" || signal?.aborted) throw primaryErr;
        console.warn(`[Build Route] ${primaryModel} xətası baş verdi, fallback modelinə (${fallbackModel}) yönləndirilir:`, primaryErr.message || primaryErr);
      }
    }

    // 2. Fallback: Gemini (gemini-3.8-flash)
    if (!hasGeminiConfiguration()) {
      throw new LLMProviderError("Google Gemini xidməti hələ konfiqurasiya edilməyib. GEMINI_API_KEY əlavə et və yenidən yoxla.", {
        code: "AI_NOT_CONFIGURED",
        status: 503,
        model: fallbackModel,
        provider: "google",
      });
    }

    return await tryGenerateWithGemini({
      model: fallbackModel,
      schema,
      name,
      instructions,
      input,
      maxOutputTokens,
      signal,
      onChunk,
      onUsage,
    });
  } else {
    // 1. Primary: Try Gemini
    if (hasGeminiConfiguration()) {
      try {
        return await tryGenerateWithGemini({
          model: primaryModel,
          schema,
          name,
          instructions,
          input,
          maxOutputTokens,
          signal,
          onChunk,
          onUsage,
        });
      } catch (geminiError) {
        if (geminiError.name === "AbortError" || signal?.aborted) throw geminiError;
        console.warn(`[Build Route] ${primaryModel} xətası baş verdi, fallback modelinə (${fallbackModel}) yönləndirilir:`, geminiError.message || geminiError);
      }
    }

    // 2. Fallback: OpenAI
    if (!hasOpenAIConfiguration()) {
      throw new LLMProviderError("OpenAI xidməti hələ konfiqurasiya edilməyib. OPENAI_API_KEY əlavə et və yenidən yoxla.", {
        code: "AI_NOT_CONFIGURED",
        status: 503,
        model: fallbackModel,
        provider: "openai",
      });
    }

    return await tryGenerateWithOpenAI({
      model: fallbackModel,
      schema,
      name,
      instructions,
      input,
      maxOutputTokens,
      reasoning,
      ownerId,
      signal,
      onChunk,
      onUsage,
    });
  }
}
