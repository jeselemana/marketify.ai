import { aiConfig, hasGeminiConfiguration } from "./config.js";

const DEFAULT_GEMINI_CANDIDATES = [
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
];

/**
 * Normalizes and formats chat history into Gemini API contents structure.
 * Converts 'assistant' -> 'model', and merges consecutive messages of the same role.
 */
export function formatGeminiContents(messages = []) {
  const normalized = [];

  for (const message of messages) {
    if (!message || typeof message.content !== "string") continue;
    const content = message.content.trim();
    if (!content) continue;

    const role = message.role === "assistant" || message.role === "model" ? "model" : "user";
    const last = normalized[normalized.length - 1];

    if (last && last.role === role) {
      last.parts[0].text += `\n\n${content}`;
    } else {
      normalized.push({
        role,
        parts: [{ text: content }],
      });
    }
  }

  // Ensure conversation does not start with an orphan model message
  while (normalized.length > 0 && normalized[0].role === "model") {
    normalized.shift();
  }

  // Ensure conversation ends with a user message for Gemini API compliance
  while (normalized.length > 0 && normalized[normalized.length - 1].role === "model") {
    normalized.pop();
  }

  return normalized;
}

/**
 * Builds the generationConfig object for Gemini API calls matching GPT-5.6 Luna response generation.
 */
function buildGenerationConfig({
  maxOutputTokens = aiConfig.askMaxOutputTokens || 8192,
} = {}) {
  return {
    maxOutputTokens: Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? maxOutputTokens : 8192,
  };
}

/**
 * Generates an Ask response using Google's Gemini API (e.g. gemini-3.7-flash) matching GPT-5.6 Luna generation settings.
 */
export async function generateGeminiAskResponse({
  messages = [],
  systemInstruction = "",
  model = aiConfig.geminiAskModel || "gemini-3.7-flash",
  apiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY,
  maxOutputTokens = aiConfig.askMaxOutputTokens || 8192,
  signal,
} = {}) {
  const rawKey = (apiKey || aiConfig.geminiApiKey || process.env.GEMINI_API_KEY || "") + "";
  const key = rawKey.trim().replace(/^["']|["']$/g, "").trim();
  if (!key) {
    const error = new Error("Canlı serverdə GEMINI_API_KEY mühit dəyişəni (Environment Variable) daxil edilməyib. Zəhmət olmasa hosting panelində GEMINI_API_KEY açarını əlavə edin.");
    error.code = "AI_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }

  const contents = formatGeminiContents(messages);
  if (!contents.length) {
    const error = new Error("Mesaj daxil edilməyib.");
    error.code = "INVALID_REQUEST";
    error.status = 400;
    throw error;
  }

  const candidateModels = [model, ...DEFAULT_GEMINI_CANDIDATES].filter((v, i, a) => a.indexOf(v) === i);

  let lastError;

  for (const currentModel of candidateModels) {
    const generationConfig = buildGenerationConfig({
      maxOutputTokens,
    });

    const payload = {
      contents,
      generationConfig,
    };

    if (systemInstruction && typeof systemInstruction === "string" && systemInstruction.trim()) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction.trim() }],
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(key)}`;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal,
        });

        const data = await response.json().catch(() => null);

        if (response.ok) {
          if (data?.promptFeedback?.blockReason) {
            const error = new Error(`Cavab təhlükəsizlik filtrinə görə bloklandı (${data.promptFeedback.blockReason}).`);
            error.code = "AI_SAFETY_BLOCKED";
            error.status = 400;
            throw error;
          }

          const candidate = data?.candidates?.[0];
          const finishReason = candidate?.finishReason;
          if (finishReason === "SAFETY") {
            const error = new Error("Cavab təhlükəsizlik filtrinə görə dayandırıldı.");
            error.code = "AI_SAFETY_BLOCKED";
            error.status = 400;
            throw error;
          }

          const parts = candidate?.content?.parts || [];
          const textParts = parts.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text);
          const replyText = (textParts.length ? textParts.join("") : parts.map((p) => p.text).filter(Boolean).join(""))?.trim();

          if (replyText) {
            return replyText;
          }
        }

        // If transient high demand or rate limit, retry once after backoff or try next candidate model
        if ((response.status === 503 || response.status === 429) && attempt === 0) {
          await new Promise((res) => setTimeout(res, 500));
          continue;
        }

        const errorMessage = data?.error?.message || `Gemini API xətası (${response.status})`;
        const error = new Error(errorMessage);
        error.status = response.status;
        if (response.status === 401 || response.status === 403) {
          error.code = "AI_AUTH_ERROR";
        } else if (response.status === 429) {
          error.code = "AI_RATE_LIMIT";
        } else if (response.status === 404) {
          error.code = "AI_MODEL_NOT_FOUND";
        } else {
          error.code = "GEMINI_ERROR";
        }
        lastError = error;
        break;
      } catch (fetchErr) {
        lastError = fetchErr;
        if (attempt === 0) {
          await new Promise((res) => setTimeout(res, 500));
          continue;
        }
        break;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Gemini boş cavab qaytardı.");
}

/**
 * Streams an Ask response chunk by chunk using Google's Gemini streamGenerateContent SSE API.
 * Uses line-by-line SSE parsing and automatic failover across candidate models.
 */
export async function generateGeminiAskStreamResponse({
  messages = [],
  systemInstruction = "",
  model = aiConfig.geminiAskModel || "gemini-3.7-flash",
  apiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY,
  maxOutputTokens = aiConfig.askMaxOutputTokens || 8192,
  signal,
  onChunk = () => {},
} = {}) {
  const rawKey = (apiKey || aiConfig.geminiApiKey || process.env.GEMINI_API_KEY || "") + "";
  const key = rawKey.trim().replace(/^["']|["']$/g, "").trim();
  if (!key) {
    const error = new Error("Canlı serverdə GEMINI_API_KEY mühit dəyişəni (Environment Variable) daxil edilməyib. Zəhmət olmasa hosting panelində GEMINI_API_KEY açarını əlavə edin.");
    error.code = "AI_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }

  const contents = formatGeminiContents(messages);
  if (!contents.length) {
    const error = new Error("Mesaj daxil edilməyib.");
    error.code = "INVALID_REQUEST";
    error.status = 400;
    throw error;
  }

  const candidateModels = [model, ...DEFAULT_GEMINI_CANDIDATES].filter((v, i, a) => a.indexOf(v) === i);
  const generationConfig = buildGenerationConfig({ maxOutputTokens });

  const payload = {
    contents,
    generationConfig,
  };

  if (systemInstruction && typeof systemInstruction === "string" && systemInstruction.trim()) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction.trim() }],
    };
  }

  let lastError;
  let fullAccumulated = "";

  for (const currentModel of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMessage = data?.error?.message || `Gemini API xətası (${response.status})`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.code = response.status === 401 || response.status === 403 ? "AI_AUTH_ERROR" : "GEMINI_ERROR";
        throw error;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let rawBuffer = "";
      let eventLines = [];
      let modelAccumulated = "";

      const dispatchEventLines = (lines) => {
        if (!lines || !lines.length) return;
        const dataStr = lines.join("\n").trim();
        if (!dataStr || dataStr === "[DONE]") return;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed?.error) {
            const errorMsg = parsed.error.message || `Gemini stream xətası (${parsed.error.code || "unknown"})`;
            const err = new Error(errorMsg);
            err.code = "GEMINI_STREAM_ERROR";
            throw err;
          }

          const candidates = parsed?.candidates || [];
          for (const cand of candidates) {
            if (cand?.finishReason === "SAFETY") {
              const err = new Error("Cavab təhlükəsizlik filtrinə görə dayandırıldı.");
              err.code = "AI_SAFETY_BLOCKED";
              throw err;
            }
            const parts = cand?.content?.parts || [];
            for (const p of parts) {
              if (typeof p.text === "string" && p.text && !p.thought) {
                modelAccumulated += p.text;
                fullAccumulated += p.text;
                onChunk(p.text);
              }
            }
          }
        } catch (parseErr) {
          if (parseErr.code) throw parseErr;
          const matches = dataStr.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
          for (const match of matches) {
            try {
              const unescaped = JSON.parse(`"${match[1]}"`);
              if (unescaped) {
                modelAccumulated += unescaped;
                fullAccumulated += unescaped;
                onChunk(unescaped);
              }
            } catch {}
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        rawBuffer += decoder.decode(value, { stream: true });
        const lines = rawBuffer.split(/\r?\n/);
        rawBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            eventLines.push(line.replace(/^data:\s*/, ""));
          } else if (line.trim() === "" && eventLines.length > 0) {
            dispatchEventLines(eventLines);
            eventLines = [];
          }
        }
      }

      if (eventLines.length > 0) {
        dispatchEventLines(eventLines);
        eventLines = [];
      }

      if (modelAccumulated.trim()) {
        return fullAccumulated.trim();
      }
    } catch (err) {
      console.warn(`[Gemini Stream] Model ${currentModel} error:`, err?.message);
      lastError = err;
      if (fullAccumulated.trim()) {
        break;
      }
    }
  }

  // If streaming yielded no chunks or failed early, fallback to non-stream generation
  if (!fullAccumulated.trim()) {
    try {
      const fallbackText = await generateGeminiAskResponse({
        messages,
        systemInstruction,
        model,
        apiKey,
        maxOutputTokens,
        signal,
      });

      if (fallbackText) {
        onChunk(fallbackText);
        return fallbackText;
      }
    } catch (fallbackErr) {
      lastError = fallbackErr;
    }
  }

  if (lastError && !fullAccumulated.trim()) {
    throw lastError;
  }

  if (!fullAccumulated.trim()) {
    throw new Error("Gemini boş cavab qaytardı.");
  }

  return fullAccumulated.trim();
}

