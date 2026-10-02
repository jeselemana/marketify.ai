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
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const hasServiceAccount = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT
    );
    const isVertex = process.env.GEMINI_USE_VERTEX === "true" ||
      apiKey?.startsWith("AQ.") ||
      hasServiceAccount;

    // When authenticating to Vertex AI using a Service Account / ADC, restricted or expired
    // API keys in GEMINI_API_KEY override ADC credentials and trigger 403 Permission Denied.
    if (isVertex && process.env.GOOGLE_APPLICATION_CREDENTIALS && apiKey?.startsWith("AQ.")) {
      delete process.env.GEMINI_API_KEY;
    }

    const passApiKey = apiKey && !isVertex;

    geminiClient = wrapProvider(new GoogleGenAI({
      ...(passApiKey ? { apiKey } : {}),
      ...(isVertex ? { vertexai: true } : {}),
      ...(isVertex ? { location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || "global" } : {}),
      ...((process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT)?.trim()
        ? { project: (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT).trim() }
        : {}),
      httpOptions: { timeout: 180000 },
    }), "gemini");
  }

  return geminiClient;
}
