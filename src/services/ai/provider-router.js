import { zodTextFormat } from "openai/helpers/zod";
import { StrategySchema } from "../../domain/strategy.js";
import { getOpenAIClient } from "./client.js";

export const BUILD_MODELS = Object.freeze({
  FLASH: "gemini-3.7-flash",
  CORE: "gpt-5.6-terra",
});

const SUPPORTED_MODELS = new Set(Object.values(BUILD_MODELS));
function providerError(message, { code = "AI_PROVIDER_ERROR", status = 502, provider, cause } = {}) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  error.status = status;
  error.provider = provider;
  return error;
}

export function assertBuildModel(selectedModel) {
  if (!SUPPORTED_MODELS.has(selectedModel)) {
    throw providerError("Seçilmiş AI modeli dəstəklənmir.", {
      code: "AI_MODEL_UNSUPPORTED",
      status: 400,
    });
  }
  return selectedModel;
}

export function resolveBuildProvider(selectedModel) {
  assertBuildModel(selectedModel);
  if (selectedModel === BUILD_MODELS.FLASH) return Object.freeze({ provider: "google", model: BUILD_MODELS.FLASH });
  if (selectedModel === BUILD_MODELS.CORE) return Object.freeze({ provider: "openai", model: BUILD_MODELS.CORE });
  throw providerError("Seçilmiş model üçün marşrut təyin edilməyib.", {
    code: "AI_MODEL_UNSUPPORTED",
    status: 400,
  });
}

export function mapProviderError(error, provider) {
  if (error?.name === "AbortError") return error;
  if (error?.code?.startsWith?.("AI_")) return error;

  const status = Number(error?.status || error?.statusCode || 0);
  if (status === 429) {
    return providerError(
      `${provider === "google" ? "Flash" : "Core"} sorğu limitinə çatdı. Bir az gözlə və eyni modeli yenidən yoxla.`,
      { code: "AI_RATE_LIMITED", status: 429, provider, cause: error },
    );
  }
  if (status === 503) {
    return providerError(
      `${provider === "google" ? "Flash" : "Core"} xidməti müvəqqəti əlçatan deyil. Model avtomatik dəyişdirilmədi.`,
      { code: "AI_SERVICE_UNAVAILABLE", status: 503, provider, cause: error },
    );
  }
  if (status === 401 || status === 403) {
    return providerError(
      `${provider === "google" ? "Google" : "OpenAI"} API bağlantısı doğrulanmadı. Server açarını yoxla.`,
      { code: "AI_AUTH_ERROR", status: 503, provider, cause: error },
    );
  }
  return providerError(
    `${provider === "google" ? "Flash" : "Core"} generasiyanı tamamlaya bilmədi. Model avtomatik dəyişdirilmədi.`,
    { code: "AI_PROVIDER_ERROR", status: status >= 400 ? status : 502, provider, cause: error },
  );
}

function googleApiKey() {
  const key = process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw providerError("Flash üçün GOOGLE_API_KEY konfiqurasiya edilməyib.", {
      code: "AI_NOT_CONFIGURED",
      status: 503,
      provider: "google",
    });
  }
  return key;
}

async function googleError(response) {
  const payload = await response.json().catch(() => ({}));
  const error = new Error(payload?.error?.message || `Google Gen AI HTTP ${response.status}`);
  error.status = response.status;
  throw mapProviderError(error, "google");
}

async function* parseGoogleSse(body) {
  if (!body) throw providerError("Flash boş stream qaytardı.", { provider: "google" });
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines = [];

  const parseEvent = (lines) => {
    const raw = lines.join("\n").trim();
    if (!raw || raw === "[DONE]") return null;
    return JSON.parse(raw);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? "" : lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      if (!line.trim() && dataLines.length) {
        const event = parseEvent(dataLines);
        dataLines = [];
        if (event) yield event;
      }
    }
    if (done) break;
  }
  if (buffer.trim().startsWith("data:")) dataLines.push(buffer.trim().slice(5).trimStart());
  if (dataLines.length) {
    const event = parseEvent(dataLines);
    if (event) yield event;
  }
}

async function openGeminiStream({ instructions, input, textFormat, maxOutputTokens, temperature, thinkingBudget, signal }) {
  const model = BUILD_MODELS.FLASH;
  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": googleApiKey(),
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [{ role: "user", parts: [{ text: input }] }],
          generationConfig: {
            thinkingConfig: { thinkingBudget },
            maxOutputTokens,
            temperature,
            responseMimeType: "application/json",
            responseJsonSchema: textFormat.schema,
          },
        }),
        signal,
      },
    );
  } catch (error) {
    throw mapProviderError(error, "google");
  }
  if (!response.ok) await googleError(response);

  async function* events() {
    let finishReason = null;
    try {
      for await (const payload of parseGoogleSse(response.body)) {
        const candidate = payload?.candidates?.[0];
        const delta = (candidate?.content?.parts || []).map((part) => part?.text || "").join("");
        if (delta) yield { type: "delta", delta };
        if (candidate?.finishReason) finishReason = candidate.finishReason;
      }
      const normalized = finishReason === "MAX_TOKENS" ? "max_output_tokens" : (finishReason || "stop").toLowerCase();
      yield { type: "done", finishReason: normalized };
    } catch (error) {
      throw mapProviderError(error, "google");
    }
  }

  return { model, provider: "google", events: events() };
}

async function openOpenAIStream({ instructions, input, textFormat, maxOutputTokens, reasoningEffort, ownerId, signal }) {
  const model = BUILD_MODELS.CORE;
  let stream;
  try {
    stream = await getOpenAIClient().responses.create(
      {
        model,
        instructions,
        input,
        text: { format: textFormat },
        stream: true,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: reasoningEffort },
        safety_identifier: ownerId,
      },
      signal ? { signal } : undefined,
    );
  } catch (error) {
    throw mapProviderError(error, "openai");
  }

  async function* events() {
    let finishReason = "stop";
    try {
      for await (const event of stream) {
        if (event.type === "response.output_text.delta" && event.delta) {
          yield { type: "delta", delta: event.delta };
        } else if (event.type === "response.incomplete") {
          finishReason = event.response?.incomplete_details?.reason || "incomplete";
        } else if (event.type === "response.failed") {
          const failed = new Error(event.response?.error?.message || "OpenAI response failed.");
          failed.status = event.response?.error?.code === "rate_limit_exceeded" ? 429 : 502;
          throw failed;
        }
      }
      yield { type: "done", finishReason };
    } catch (error) {
      throw mapProviderError(error, "openai");
    }
  }

  return { model, provider: "openai", events: events() };
}

export async function openBuildStructuredStream({
  selectedModel,
  instructions,
  input,
  schema,
  schemaName,
  maxOutputTokens = 8192,
  temperature = 0.65,
  thinkingBudget = 0,
  reasoningEffort = "medium",
  ownerId,
  signal,
}) {
  const route = resolveBuildProvider(selectedModel);
  const textFormat = zodTextFormat(schema, schemaName);
  if (route.provider === "google") {
    return openGeminiStream({
      instructions,
      input,
      textFormat,
      maxOutputTokens,
      temperature,
      thinkingBudget,
      signal,
    });
  }
  if (route.provider === "openai") {
    return openOpenAIStream({ instructions, input, textFormat, maxOutputTokens, reasoningEffort, ownerId, signal });
  }
  // resolveBuildProvider makes this unreachable. It stays explicit to prevent
  // future provider additions from accidentally inheriting another route.
  throw providerError("Seçilmiş model üçün marşrut təyin edilməyib.", {
    code: "AI_MODEL_UNSUPPORTED",
    status: 400,
  });
}

export function openBuildStrategyStream(options) {
  return openBuildStructuredStream({
    ...options,
    schema: StrategySchema,
    schemaName: "marketify_strategy",
    maxOutputTokens: 8192,
    temperature: 0.65,
    thinkingBudget: 0,
    reasoningEffort: "medium",
  });
}

export function parseStreamedStrategy(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return StrategySchema.parse(JSON.parse(cleaned));
  } catch (cause) {
    throw providerError("AI cavabı tam strategiya strukturuna çevrilmədi.", {
      code: "AI_INVALID_OUTPUT",
      status: 502,
      cause,
    });
  }
}
