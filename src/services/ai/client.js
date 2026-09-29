import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { GoogleAuth } from "google-auth-library";
import { hasOpenAIConfiguration, hasGeminiConfiguration, hasOpusConfiguration, aiConfig } from "./config.js";

let client;
let geminiClient;
let googleAuth;
let testOpusCaller = null;

export function setTestOpusCaller(fn) {
  testOpusCaller = fn;
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

  const model = aiConfig.opusModel || "opus-5.5";
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const gcpLocation = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1";

  // 1. Direct Anthropic API option if key is set
  if (anthropicApiKey) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          system: system || undefined,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.warn(`[Opus Direct API] HTTP ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json();
      const text = (data.content || []).map((c) => c.text || "").join("").trim();
      const usage = data.usage ? {
        prompt_tokens: data.usage.input_tokens || null,
        completion_tokens: data.usage.output_tokens || null,
        total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) || null,
      } : null;

      return { text, model, provider: "anthropic", usage };
    } catch (err) {
      if (err.name === "AbortError" || signal?.aborted) throw err;
      console.warn("[Opus Direct API] Xəta:", err?.message || err);
      return null;
    }
  }

  // 2. Vertex AI Model Garden
  if (gcpProject || process.env.GEMINI_API_KEY?.trim()) {
    try {
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
      };
      let endpoint = `https://${gcpLocation}-aiplatform.googleapis.com/v1/projects/${gcpProject || "default"}/locations/${gcpLocation}/publishers/anthropic/models/${model}:rawPredict`;

      if (process.env.GEMINI_API_KEY?.trim() && !gcpProject) {
        endpoint += `?key=${process.env.GEMINI_API_KEY.trim()}`;
        headers["x-goog-api-key"] = process.env.GEMINI_API_KEY.trim();
      } else {
        if (!googleAuth) {
          googleAuth = new GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
          });
        }
        const authClient = await googleAuth.getClient();
        const tokenRes = await authClient.getAccessToken();
        const token = tokenRes?.token || tokenRes;
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          anthropic_version: "vertex-2023-10-16",
          system: system || undefined,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.warn(`[Vertex AI Model Garden Opus] HTTP ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json();
      const text = (data.content || []).map((c) => c.text || "").join("").trim();
      const usage = data.usage ? {
        prompt_tokens: data.usage.input_tokens || null,
        completion_tokens: data.usage.output_tokens || null,
        total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) || null,
      } : null;

      return { text, model, provider: "vertex-anthropic", usage };
    } catch (err) {
      if (err.name === "AbortError" || signal?.aborted) throw err;
      console.warn("[Vertex AI Model Garden Opus] Xəta:", err?.message || err);
      return null;
    }
  }

  return null;
}
