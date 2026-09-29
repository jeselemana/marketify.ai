import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { hasOpenAIConfiguration, hasGeminiConfiguration, hasOpusConfiguration, aiConfig } from "./config.js";

let client;
let geminiClient;
let anthropicVertexClient = null;
let testOpusCaller = null;

export function setTestOpusCaller(fn) {
  testOpusCaller = fn;
}

export function getAnthropicVertexClient() {
  if (!anthropicVertexClient) {
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
      process.env.GCP_PROJECT?.trim() ||
      "gen-lang-client-0045930484";
    const region = "global";

    anthropicVertexClient = new AnthropicVertex({
      projectId,
      region,
    });
    if (anthropicVertexClient._authClientPromise) {
      anthropicVertexClient._authClientPromise.catch(() => {});
    }
  }
  return anthropicVertexClient;
}

export function getOpenAIClient() {
  if (!hasOpenAIConfiguration()) {
    const error = new Error("OpenAI is not configured.");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
}

export function getGeminiClient() {
  if (!hasGeminiConfiguration()) {
    const error = new Error("Gemini xidməti konfiqurasiya edilməyib. GEMINI_API_KEY əlavə edin.");
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }

  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const isVertex = process.env.GEMINI_USE_VERTEX === "true" ||
      apiKey?.startsWith("AQ.") ||
      Boolean(process.env.GOOGLE_CLOUD_PROJECT);

    geminiClient = new GoogleGenAI({
      apiKey,
      ...(isVertex ? { vertexai: true } : {}),
      ...(process.env.GOOGLE_CLOUD_LOCATION?.trim() ? { location: process.env.GOOGLE_CLOUD_LOCATION.trim() } : {}),
      ...(process.env.GOOGLE_CLOUD_PROJECT?.trim() ? { project: process.env.GOOGLE_CLOUD_PROJECT.trim() } : {}),
    });
  }

  return geminiClient;
}

export async function callOpusVertexModel({ system = "", prompt = "", maxTokens = aiConfig.opusMaxTokens, signal } = {}) {
  if (testOpusCaller) {
    return await testOpusCaller({ system, prompt, maxTokens, signal });
  }

  if (!hasOpusConfiguration()) {
    return null;
  }

  const model = aiConfig.opusModel || "claude-opus-5-5";

  try {
    const vertex = getAnthropicVertexClient();
    const response = await vertex.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: system || undefined,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      },
      { signal }
    );

    const text = (response.content || []).map((c) => c.text || "").join("").trim();
    const usage = response.usage ? {
      prompt_tokens: response.usage.input_tokens || null,
      completion_tokens: response.usage.output_tokens || null,
      total_tokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0) || null,
    } : null;

    return { text, model, provider: "vertex-anthropic", usage };
  } catch (err) {
    if (err.name === "AbortError" || signal?.aborted) throw err;
    console.error("❌ [Opus Vertex AI Xətası]:", err);
    return null;
  }
}
