import { aiConfig, hasGeminiConfiguration } from "./config.js";

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

  return normalized;
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
  maxOutputTokens = 3000,
  signal,
} = {}) {
  const key = apiKey?.trim();
  if (!key) {
    const error = new Error("Gemini API açarı konfiqurasiya edilməyib.");
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

  const payload = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  if (systemInstruction && typeof systemInstruction === "string" && systemInstruction.trim()) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction.trim() }],
    };
  }

  const candidateModels = [model];
  if (model === "gemini-3.7-flash") {
    candidateModels.push("gemini-3.6-flash");
  }

  let response;
  let data;
  let lastError;

  for (const currentModel of candidateModels) {
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

        // If transient high demand or rate limit, retry once or try fallback model
        if ((response.status === 503 || response.status === 429) && attempt === 0) {
          await new Promise((res) => setTimeout(res, 600));
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
          await new Promise((res) => setTimeout(res, 600));
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

  const replyText = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("")?.trim();

  if (!replyText) {
    const finishReason = data?.candidates?.[0]?.finishReason;
    const error = new Error(
      finishReason === "SAFETY"
        ? "Cavab təhlükəsizlik filtrinə görə dayandırıldı."
        : "Gemini boş cavab qaytardı.",
    );
    error.code = "AI_EMPTY_RESPONSE";
    error.status = 500;
    throw error;
  }

  return replyText;
}
