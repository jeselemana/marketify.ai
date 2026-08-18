import OpenAI from "openai";
import { getAIProvider, hasAIConfiguration, hasGeminiConfiguration, hasOpenAIConfiguration } from "./config.js";

let openAIClient = null;

export function getGeminiApiKey() {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
}

export function getOpenAIClient() {
  if (!hasOpenAIConfiguration()) {
    const error = new Error("OpenAI is not configured.");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  if (!openAIClient) {
    openAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return openAIClient;
}

export async function executeGeminiGenerate({
  model = "gemini-3.7-flash",
  systemInstruction = "",
  prompt = "",
  responseFormat = "application/json",
  temperature = 0.2,
  maxOutputTokens = 8192,
  signal,
}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const error = new Error("Gemini API key is not configured.");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  if (responseFormat === "application/json") {
    requestBody.generationConfig.responseMimeType = "application/json";
  }

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      const abortErr = new Error("Generation aborted");
      abortErr.name = "AbortError";
      throw abortErr;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || `HTTP ${response.status}`;
        console.warn(`[Gemini API] Attempt ${attempt}/${maxAttempts} error (${response.status}):`, errorMessage);

        if (response.status === 429 || response.status === 503 || response.status === 500) {
          if (attempt < maxAttempts) {
            const retryMatch = errorMessage.match(/Please retry in ([\d\.]+)s/i);
            const waitMs = retryMatch
              ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000
              : Math.min(attempt * 2500, 10000);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.code = response.status === 401 ? "AI_AUTH_ERROR" : "AI_GATEWAY_ERROR";
        throw error;
      }

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;

      if (!text && candidate?.finishReason && candidate.finishReason !== "STOP") {
        throw new Error(`Gemini finish reason: ${candidate.finishReason}`);
      }

      return text || "";
    } catch (err) {
      if (err.name === "AbortError") throw err;
      if (attempt >= maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

export async function executeGeminiChat({
  model = "gemini-3.7-flash",
  instructions = "",
  messages = [],
  temperature = 0.7,
  maxOutputTokens = 2500,
  signal,
}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const error = new Error("Gemini API key is not configured.");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  const contents = messages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  if (instructions) {
    requestBody.systemInstruction = {
      parts: [{ text: instructions }],
    };
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      const abortErr = new Error("Chat aborted");
      abortErr.name = "AbortError";
      throw abortErr;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || `HTTP ${response.status}`;
        if (response.status === 429 || response.status === 503) {
          if (attempt < maxAttempts) {
            const retryMatch = errorMessage.match(/Please retry in ([\d\.]+)s/i);
            const waitMs = retryMatch
              ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000
              : attempt * 2000;
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }
        }
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return reply || "";
    } catch (err) {
      if (err.name === "AbortError") throw err;
      if (attempt >= maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}
