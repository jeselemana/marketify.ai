import { aiConfig, hasGeminiConfiguration } from "./config.js";

/**
 * Normalizes and formats chat history into Gemini API contents structure.
 * Converts 'assistant' -> 'model', and merges consecutive messages of the same role.
 */
export function formatGeminiContents(messages = [], maxMessages = aiConfig.geminiAskHistoryMessages) {
  const normalized = [];
  // Ask is interactive chat, so preserve only a small, useful recent window.
  // Long histories substantially increase Flash's time-to-first-token.
  const historyLimit = Number.isFinite(maxMessages) && maxMessages > 0 ? maxMessages : 12;
  const recentMessages = messages.length > historyLimit ? messages.slice(-historyLimit) : messages;

  for (const message of recentMessages) {
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
 * Builds the generationConfig object for Gemini API calls.
 */
function buildGenerationConfig({
  model = "",
  temperature = 0.6,
  maxOutputTokens = aiConfig.geminiAskMaxOutputTokens || 65536,
} = {}) {
  const config = {
    temperature: typeof temperature === "number" ? temperature : 0.6,
    maxOutputTokens: Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? maxOutputTokens : 65536,
  };

  // For Gemini 3.7 Flash and reasoning-capable models:
  // Configure thinkingBudget (0 = disable thinking for instant chat, or custom budget integer)
  if (model.includes("3.7") || model.includes("flash") || model.includes("thinking")) {
    const budget = typeof aiConfig.geminiThinkingBudget === "number" ? aiConfig.geminiThinkingBudget : 0;
    config.thinkingConfig = {
      thinkingBudget: budget,
    };
  }

  return config;
}

/**
 * Generates an Ask response using Google's Gemini API (e.g. gemini-3.7-flash).
 */
export async function generateGeminiAskResponse({
  messages = [],
  systemInstruction = "",
  model = aiConfig.geminiAskModel || "gemini-3.7-flash",
  apiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY,
  temperature = 0.6,
  maxOutputTokens = aiConfig.geminiAskMaxOutputTokens,
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

  const candidateModels = [model];

  let response;
  let data;
  let lastError;

  for (const currentModel of candidateModels) {
    const generationConfig = buildGenerationConfig({
      model: currentModel,
      temperature,
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
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal,
        });

        data = await response.json().catch(() => null);

        if (response.ok) {
          lastError = null;
          break;
        }

        // If transient high demand or rate limit, retry once after backoff
        if ((response.status === 503 || response.status === 429) && attempt === 0) {
          await new Promise((res) => setTimeout(res, 800));
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
          await new Promise((res) => setTimeout(res, 800));
          continue;
        }
        break;
      }
    }

    if (response?.ok) {
      break;
    }
  }

  if (lastError) {
    throw lastError;
  }

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

  if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
    console.warn(`[Gemini] Non-standard finishReason: ${finishReason}`);
  }

  const parts = candidate?.content?.parts || [];
  const textParts = parts.filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text);
  const replyText = (textParts.length ? textParts.join("") : parts.map((p) => p.text).filter(Boolean).join(""))?.trim();

  if (!replyText) {
    const error = new Error("Gemini boş cavab qaytardı.");
    error.code = "AI_EMPTY_RESPONSE";
    error.status = 500;
    throw error;
  }

  return replyText;
}

/**
 * Streams an Ask response chunk by chunk using Google's Gemini streamGenerateContent SSE API.
 */
export async function generateGeminiAskStreamResponse({
  messages = [],
  systemInstruction = "",
  model = aiConfig.geminiAskModel || "gemini-3.7-flash",
  apiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY,
  temperature = 0.6,
  maxOutputTokens = aiConfig.geminiAskMaxOutputTokens,
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

  const generationConfig = buildGenerationConfig({
    model,
    temperature,
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;

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
  let buffer = "";
  let fullText = "";

  const processEventBlock = (block) => {
    if (!block || !block.trim()) return;
    const lines = block.split(/\r?\n/);
    const dataLines = [];
    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataLines.push(line.replace(/^data:\s*/, ""));
      }
    }
    if (!dataLines.length) return;
    const jsonStr = dataLines.join("\n").trim();
    if (!jsonStr || jsonStr === "[DONE]") return;

    try {
      const parsed = JSON.parse(jsonStr);

      if (parsed?.error) {
        const errorMsg = parsed.error.message || `Gemini API xətası (${parsed.error.code || "unknown"})`;
        const err = new Error(errorMsg);
        err.code = "GEMINI_STREAM_ERROR";
        throw err;
      }

      if (parsed?.promptFeedback?.blockReason) {
        const err = new Error(`Cavab təhlükəsizlik filtrinə görə bloklandı (${parsed.promptFeedback.blockReason}).`);
        err.code = "AI_SAFETY_BLOCKED";
        throw err;
      }

      const candidates = parsed?.candidates || [];
      for (const cand of candidates) {
        if (cand?.finishReason === "SAFETY") {
          const err = new Error("Cavab təhlükəsizlik filtrinə görə dayandırıldı.");
          err.code = "AI_SAFETY_BLOCKED";
          throw err;
        }
        if (cand?.finishReason && cand.finishReason !== "STOP" && cand.finishReason !== "MAX_TOKENS") {
          console.warn(`[Gemini SSE] Finish reason: ${cand.finishReason}`);
        }
        const parts = cand?.content?.parts || [];
        for (const p of parts) {
          if (!p.thought && typeof p.text === "string" && p.text) {
            fullText += p.text;
            onChunk(p.text);
          }
        }
      }
    } catch (parseErr) {
      if (parseErr.code) throw parseErr;
      // Fallback regex extractor if JSON was broken across lines
      const matches = jsonStr.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
      for (const match of matches) {
        try {
          const unescaped = JSON.parse(`"${match[1]}"`);
          if (unescaped) {
            fullText += unescaped;
            onChunk(unescaped);
          }
        } catch {}
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundaryIdx;
    while ((boundaryIdx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const match = buffer.match(/\r?\n\r?\n/);
      const separatorLen = match[0].length;
      const block = buffer.slice(0, boundaryIdx);
      buffer = buffer.slice(boundaryIdx + separatorLen);
      processEventBlock(block);
    }
  }

  // Flush any remaining buffer
  if (buffer.trim()) {
    processEventBlock(buffer);
  }

  if (!fullText.trim()) {
    throw new Error("Gemini boş cavab qaytardı.");
  }

  return fullText.trim();
}
