import { createHash } from "node:crypto";
import { zodTextFormat } from "openai/helpers/zod";
import { aiConfig, hasGeminiConfiguration, hasOpenAIConfiguration } from "./config.js";
import { getOpenAIClient } from "./client.js";
import { normalizeBuildModel } from "../../domain/strategy.js";

function privacySafeIdentifier(ownerId) {
  if (!ownerId) return undefined;
  return createHash("sha256").update(ownerId).digest("hex").slice(0, 32);
}

export class LLMProviderError extends Error {
  constructor(message, { code = "LLM_ROUTER_ERROR", status = 500, model = "unknown", provider = "unknown", details = null } = {}) {
    super(message);
    this.name = "LLMProviderError";
    this.code = code;
    this.status = status;
    this.model = model;
    this.provider = provider;
    this.details = details;
  }
}

/**
 * Executes a streaming generation request to Gemini 3.7 Flash using Google GenAI REST API.
 */
export async function streamGeminiContent({
  instructions = "",
  input = "",
  onChunk,
  signal,
  temperature = aiConfig.geminiTemperature,
  maxOutputTokens = aiConfig.geminiMaxOutputTokens,
  thinkingBudget = aiConfig.geminiThinkingBudget,
  jsonMode = true,
}) {
  if (!hasGeminiConfiguration()) {
    throw new LLMProviderError("Gemini AI xidməti hələ konfiqurasiya edilməyib. GEMINI_API_KEY əlavə et və yenidən yoxla.", {
      code: "AI_NOT_CONFIGURED",
      status: 503,
      model: aiConfig.geminiModel,
      provider: "google",
    });
  }

  const modelId = aiConfig.geminiModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:streamGenerateContent?alt=sse`;

  const generationConfig = {
    temperature: typeof temperature === "number" ? temperature : 0.7,
    maxOutputTokens: typeof maxOutputTokens === "number" ? maxOutputTokens : 8192,
  };

  if (typeof thinkingBudget === "number") {
    generationConfig.thinkingConfig = { thinkingBudget };
  }

  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: String(input || "") }],
      },
    ],
    generationConfig,
  };

  if (instructions) {
    payload.systemInstruction = {
      parts: [{ text: String(instructions) }],
    };
  }

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY.trim(),
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (netErr) {
    if (netErr.name === "AbortError" || signal?.aborted) {
      throw netErr;
    }
    throw new LLMProviderError(`Gemini ilə bağlantı qurmaq mümkün olmadı: ${netErr.message}`, {
      code: "AI_NETWORK_ERROR",
      status: 502,
      model: modelId,
      provider: "google",
      details: netErr,
    });
  }

  if (!response.ok) {
    let errBody = null;
    try {
      errBody = await response.json();
    } catch {
      try { errBody = await response.text(); } catch {}
    }

    const httpStatus = response.status;
    const googleErrorMessage = errBody?.error?.message || (typeof errBody === "string" ? errBody : "Naməlum xəta");

    if (httpStatus === 429 || googleErrorMessage.includes("RESOURCE_EXHAUSTED") || googleErrorMessage.includes("quota")) {
      throw new LLMProviderError("Gemini 3.7 Flash xidmətində sorğu limiti aşılıb (429). Zəhmət olmasa bir az sonra yenidən cəhd edin.", {
        code: "AI_RATE_LIMITED",
        status: 429,
        model: modelId,
        provider: "google",
        details: errBody,
      });
    }

    if (httpStatus === 401 || httpStatus === 403 || googleErrorMessage.includes("API_KEY_INVALID")) {
      throw new LLMProviderError("Gemini API açarı etibarsızdır. GEMINI_API_KEY konfiqurasiyasını yoxlayın.", {
        code: "AI_AUTH_ERROR",
        status: 503,
        model: modelId,
        provider: "google",
        details: errBody,
      });
    }

    throw new LLMProviderError(`Gemini API xətası (${httpStatus}): ${googleErrorMessage}`, {
      code: "AI_PROVIDER_ERROR",
      status: httpStatus >= 500 ? 503 : httpStatus,
      model: modelId,
      provider: "google",
      details: errBody,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let rawBuffer = "";
  let accumulatedText = "";
  let finalFinishReason = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      rawBuffer += decoder.decode(value, { stream: true });
      const lines = rawBuffer.split(/\r?\n/);
      rawBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.replace(/^data:\s*/, "").trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const candidate = parsed?.candidates?.[0];
          if (!candidate) continue;

          const textPart = candidate.content?.parts?.[0]?.text;
          const finishReason = candidate.finishReason || null;
          if (finishReason) finalFinishReason = finishReason;

          if (textPart) {
            accumulatedText += textPart;
            if (typeof onChunk === "function") {
              onChunk({ chunk: textPart, finishReason, model: modelId });
            }
          }
        } catch {
          // Ignore partial or unparseable SSE line
        }
      }
    }

    if (rawBuffer.trim().startsWith("data:")) {
      try {
        const jsonStr = rawBuffer.replace(/^data:\s*/, "").trim();
        const parsed = JSON.parse(jsonStr);
        const candidate = parsed?.candidates?.[0];
        if (candidate) {
          const textPart = candidate.content?.parts?.[0]?.text;
          const finishReason = candidate.finishReason || null;
          if (finishReason) finalFinishReason = finishReason;
          if (textPart) {
            accumulatedText += textPart;
            if (typeof onChunk === "function") {
              onChunk({ chunk: textPart, finishReason, model: modelId });
            }
          }
        }
      } catch {}
    }
  } catch (streamErr) {
    if (streamErr.name === "AbortError" || signal?.aborted) {
      throw streamErr;
    }
    throw new LLMProviderError(`Gemini stream xətası: ${streamErr.message}`, {
      code: "AI_STREAM_ERROR",
      status: 502,
      model: modelId,
      provider: "google",
      details: streamErr,
    });
  }

  return {
    text: accumulatedText,
    finishReason: finalFinishReason || "STOP",
    model: modelId,
    provider: "google",
  };
}

/**
 * Executes a streaming generation request to GPT-5.6 Terra using OpenAI SDK.
 */
export async function streamOpenAIContent({
  model = aiConfig.coreModel,
  instructions = "",
  input = "",
  onChunk,
  ownerId,
  signal,
  maxOutputTokens = aiConfig.strategyMaxOutputTokens,
  reasoning = "medium",
}) {
  if (!hasOpenAIConfiguration()) {
    throw new LLMProviderError("OpenAI xidməti hələ konfiqurasiya edilməyib. OPENAI_API_KEY əlavə et və yenidən yoxla.", {
      code: "AI_NOT_CONFIGURED",
      status: 503,
      model,
      provider: "openai",
    });
  }

  const openai = getOpenAIClient();
  let accumulatedText = "";
  let finalFinishReason = null;

  try {
    // Try streaming responses API first
    const stream = await openai.responses.create(
      {
        model,
        instructions,
        input,
        stream: true,
        reasoning: { effort: reasoning },
        max_output_tokens: maxOutputTokens,
        safety_identifier: privacySafeIdentifier(ownerId),
      },
      signal ? { signal } : undefined,
    );

    for await (const event of stream) {
      if (signal?.aborted) break;

      let chunkText = "";
      let finishReason = null;

      if (event.type === "response.output_item.delta" && event.delta?.text) {
        chunkText = event.delta.text;
      } else if (event.type === "response.output_text.delta" && event.delta) {
        chunkText = typeof event.delta === "string" ? event.delta : event.delta.value || "";
      } else if (event.type === "response.done") {
        finishReason = event.response?.status === "completed" ? "STOP" : event.response?.status || "STOP";
        finalFinishReason = finishReason;
      }

      if (chunkText) {
        accumulatedText += chunkText;
        if (typeof onChunk === "function") {
          onChunk({ chunk: chunkText, finishReason, model });
        }
      }
    }
  } catch (respErr) {
    if (respErr.name === "AbortError" || signal?.aborted) throw respErr;

    // If responses API stream fails, fall back strictly within OpenAI to Chat Completions Stream
    if (respErr.status === 429 || respErr.code === "rate_limit_exceeded") {
      throw new LLMProviderError("GPT-5.6 Terra xidmətində sorğu limiti aşılıb (429). Zəhmət olmasa bir az sonra yenidən cəhd edin.", {
        code: "AI_RATE_LIMITED",
        status: 429,
        model,
        provider: "openai",
        details: respErr,
      });
    }

    try {
      const chatStream = await openai.chat.completions.create(
        {
          model,
          messages: [
            ...(instructions ? [{ role: "system", content: instructions }] : []),
            { role: "user", content: input },
          ],
          stream: true,
          response_format: { type: "json_object" },
          max_tokens: maxOutputTokens,
        },
        signal ? { signal } : undefined,
      );

      for await (const part of chatStream) {
        if (signal?.aborted) break;
        const delta = part.choices?.[0]?.delta?.content || "";
        const finish = part.choices?.[0]?.finish_reason || null;
        if (finish) finalFinishReason = finish === "stop" ? "STOP" : finish === "length" ? "MAX_TOKENS" : finish;

        if (delta) {
          accumulatedText += delta;
          if (typeof onChunk === "function") {
            onChunk({ chunk: delta, finishReason: finalFinishReason, model });
          }
        }
      }
    } catch (chatErr) {
      if (chatErr.name === "AbortError" || signal?.aborted) throw chatErr;

      const httpStatus = chatErr.status || 500;
      if (httpStatus === 429 || chatErr.code === "rate_limit_exceeded") {
        throw new LLMProviderError("GPT-5.6 Terra xidmətində sorğu limiti aşılıb (429). Zəhmət olmasa bir az sonra yenidən cəhd edin.", {
          code: "AI_RATE_LIMITED",
          status: 429,
          model,
          provider: "openai",
          details: chatErr,
        });
      }

      if (httpStatus === 401 || chatErr.code === "invalid_api_key") {
        throw new LLMProviderError("OpenAI API açarı etibarsızdır. OPENAI_API_KEY konfiqurasiyasını yoxlayın.", {
          code: "AI_AUTH_ERROR",
          status: 503,
          model,
          provider: "openai",
          details: chatErr,
        });
      }

      throw new LLMProviderError(`OpenAI API xətası: ${chatErr.message}`, {
        code: "AI_PROVIDER_ERROR",
        status: httpStatus >= 500 ? 503 : httpStatus,
        model,
        provider: "openai",
        details: chatErr,
      });
    }
  }

  return {
    text: accumulatedText,
    finishReason: finalFinishReason || "STOP",
    model,
    provider: "openai",
  };
}

/**
 * Universal structured LLM router for Build mode.
 * Zero silent fallback: routes explicitly to requested model provider.
 */
export async function routeStructuredGeneration({
  model = aiConfig.defaultBuildModel,
  schema,
  name,
  instructions,
  input,
  maxOutputTokens,
  reasoning = "medium",
  ownerId,
  signal,
  onChunk,
}) {
  const targetModel = normalizeBuildModel(model);

  if (targetModel === "gemini-3.7-flash") {
    const streamResult = await streamGeminiContent({
      instructions: `${instructions}\n\nYou MUST return valid JSON adhering to the ${name} schema.`,
      input,
      onChunk,
      signal,
      maxOutputTokens: maxOutputTokens || aiConfig.geminiMaxOutputTokens,
      temperature: aiConfig.geminiTemperature,
      thinkingBudget: aiConfig.geminiThinkingBudget,
      jsonMode: true,
    });

    let rawText = streamResult.text.trim();
    // Strip markdown code fences if present
    if (rawText.startsWith("```json")) {
      rawText = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    } else if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    }

    try {
      const parsedJson = JSON.parse(rawText);
      const validated = schema.parse(parsedJson);
      return {
        data: validated,
        model: "gemini-3.7-flash",
        finishReason: streamResult.finishReason,
        rawText: streamResult.text,
      };
    } catch (parseError) {
      if (streamResult.finishReason === "MAX_TOKENS") {
        const error = new LLMProviderError("Strategiya generasiyası token limitinə görə yarımçıq qaldı.", {
          code: "AI_MAX_TOKENS",
          status: 422,
          model: "gemini-3.7-flash",
          provider: "google",
          details: { partialText: streamResult.text, parseError: parseError.message },
        });
        error.partialText = streamResult.text;
        throw error;
      }
      throw new LLMProviderError(`Gemini çıxışı JSON sxeminə uyğunlaşdırılmadı: ${parseError.message}`, {
        code: "AI_INVALID_OUTPUT",
        status: 502,
        model: "gemini-3.7-flash",
        provider: "google",
        details: { rawText: streamResult.text },
      });
    }
  }

  // Target model is GPT-5.6 Terra
  if (typeof onChunk === "function") {
    const streamResult = await streamOpenAIContent({
      model: aiConfig.strategyModel,
      instructions: `${instructions}\n\nYou MUST return valid JSON adhering to the ${name} schema.`,
      input,
      onChunk,
      ownerId,
      signal,
      maxOutputTokens: maxOutputTokens || aiConfig.strategyMaxOutputTokens,
      reasoning,
    });

    let rawText = streamResult.text.trim();
    if (rawText.startsWith("```json")) {
      rawText = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    } else if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    }

    try {
      const parsedJson = JSON.parse(rawText);
      const validated = schema.parse(parsedJson);
      return {
        data: validated,
        model: "gpt-5.6-terra",
        finishReason: streamResult.finishReason,
        rawText: streamResult.text,
      };
    } catch (parseError) {
      if (streamResult.finishReason === "MAX_TOKENS") {
        const error = new LLMProviderError("Strategiya generasiyası token limitinə görə yarımçıq qaldı.", {
          code: "AI_MAX_TOKENS",
          status: 422,
          model: "gpt-5.6-terra",
          provider: "openai",
          details: { partialText: streamResult.text, parseError: parseError.message },
        });
        error.partialText = streamResult.text;
        throw error;
      }
      throw new LLMProviderError(`OpenAI çıxışı JSON sxeminə uyğunlaşdırılmadı: ${parseError.message}`, {
        code: "AI_INVALID_OUTPUT",
        status: 502,
        model: "gpt-5.6-terra",
        provider: "openai",
        details: { rawText: streamResult.text },
      });
    }
  }

  // Non-streaming OpenAI response via responses.parse
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
      });
    }

    return {
      data: response.output_parsed,
      model: "gpt-5.6-terra",
      finishReason: "STOP",
      rawText: JSON.stringify(response.output_parsed),
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
