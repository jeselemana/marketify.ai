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

export function resolveGeminiClientOptions(env = process.env, existsSync = fs.existsSync) {
  const credPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const hasValidCredFile = Boolean(credPath && existsSync(credPath));
  const apiKey = env.GEMINI_API_KEY?.trim();
  const isVertexKey = Boolean(apiKey?.startsWith("AQ."));
  const project = (env.GOOGLE_CLOUD_PROJECT || env.GCP_PROJECT)?.trim() || "";
  const location = env.GOOGLE_CLOUD_LOCATION?.trim() || "global";
  const hasServiceAccount = Boolean(hasValidCredFile || project);
  const isVertex = env.GEMINI_USE_VERTEX === "true" ||
    isVertexKey ||
    (!apiKey && hasServiceAccount);

  // Vertex AI with ADC / Service Account / GCP Project must not simultaneously pass a non-Vertex Developer API key
  const useVertexProjectAuth = Boolean(isVertex && !isVertexKey && hasServiceAccount);
  const passApiKey = Boolean(apiKey && !useVertexProjectAuth);

  return {
    credPath,
    hasValidCredFile,
    options: {
      ...(passApiKey ? { apiKey } : {}),
      ...(isVertex ? { vertexai: true } : {}),
      ...(isVertex && !isVertexKey ? { location } : {}),
      ...(isVertex && !isVertexKey && project ? { project } : {}),
      httpOptions: { timeout: 180000 },
    },
  };
}

export function getGeminiClient() {
  if (!hasGeminiConfiguration()) {
    const error = new Error("Gemini xidməti konfiqurasiya edilməyib. GEMINI_API_KEY və ya Vertex layihə ID-si əlavə edin.");
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }

  if (!geminiClient) {
    const { credPath, hasValidCredFile, options } = resolveGeminiClientOptions(process.env, fs.existsSync);
    if (credPath && !hasValidCredFile) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }

    const savedProject = process.env.GOOGLE_CLOUD_PROJECT;
    const savedGcpProject = process.env.GCP_PROJECT;
    const savedLocation = process.env.GOOGLE_CLOUD_LOCATION;
    if (options.vertexai && options.apiKey) {
      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.GCP_PROJECT;
      delete process.env.GOOGLE_CLOUD_LOCATION;
    }
    try {
      geminiClient = wrapProvider(new GoogleGenAI(options), "gemini");
    } finally {
      if (options.vertexai && options.apiKey) {
        if (savedProject !== undefined) process.env.GOOGLE_CLOUD_PROJECT = savedProject;
        if (savedGcpProject !== undefined) process.env.GCP_PROJECT = savedGcpProject;
        if (savedLocation !== undefined) process.env.GOOGLE_CLOUD_LOCATION = savedLocation;
      }
    }
  }

  return geminiClient;
}
