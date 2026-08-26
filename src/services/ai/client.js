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
      ...(process.env.GOOGLE_CLOUD_LOCATION ? { location: process.env.GOOGLE_CLOUD_LOCATION } : {}),
      ...(process.env.GOOGLE_CLOUD_PROJECT ? { project: process.env.GOOGLE_CLOUD_PROJECT } : {}),
    });
  }

  return geminiClient;
}
