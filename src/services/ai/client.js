import fs from "node:fs";
import { wrapProvider } from "../security/provider-policy.js";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { hasOpenAIConfiguration, hasGeminiConfiguration } from "./config.js";

let client;
let geminiClient;

export function getOpenAIClient() {
  if (!hasOpenAIConfiguration()) {
    const error = new Error("OpenAI is not configured.");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  if (!client) {
    client = wrapProvider(new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 180000, maxRetries: 0 }), "openai");
  }

  return client;
}

export function getGeminiClient() {
  if (!hasGeminiConfiguration()) {
    const error = new Error("Gemini xidməti konfiqurasiya edilməyib. GEMINI_API_KEY və ya Vertex layihə ID-si əlavə edin.");
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }

  if (!geminiClient) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    const hasValidCredFile = Boolean(credPath && fs.existsSync(credPath));
    if (credPath && !hasValidCredFile) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const isVertexKey = Boolean(apiKey?.startsWith("AQ."));
    const hasServiceAccount = Boolean(
      hasValidCredFile ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT
    );
    const isVertex = process.env.GEMINI_USE_VERTEX === "true" ||
      isVertexKey ||
      (!apiKey && hasServiceAccount);

    const passApiKey = Boolean(apiKey);

    geminiClient = wrapProvider(new GoogleGenAI({
      ...(passApiKey ? { apiKey } : {}),
      ...(isVertex ? { vertexai: true } : {}),
      ...(isVertex && !isVertexKey ? { location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || "global" } : {}),
      ...(isVertex && !isVertexKey && (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT)?.trim()
        ? { project: (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT).trim() }
        : {}),
      httpOptions: { timeout: 180000 },
    }), "gemini");
  }

  return geminiClient;
}
