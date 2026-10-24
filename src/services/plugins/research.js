import { hasGeminiConfiguration } from "../ai/config.js";
import { isLowQualityDomain, scoreDomain } from "../ai/research-service.js";

function safeSource(url, title) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.href.length > 2000) return null;
    if (isLowQualityDomain(parsed.hostname)) return null;
    return { web: { uri: parsed.href, title: String(title || parsed.hostname).slice(0, 180) } };
  } catch {
    return null;
  }
}

export function createWebResearch({ geminiResearch } = {}) {
  return async ({ messages, instructions, signal, onChunk }) => {
    if (hasGeminiConfiguration() && geminiResearch) {
      try {
        const result = await geminiResearch({ messages, instructions, signal, onChunk });
        const groundingChunks = (result.groundingMetadata?.groundingChunks || [])
          .map(chunk => safeSource(chunk.web?.uri, chunk.web?.title))
          .filter(Boolean)
          .sort((a, b) => scoreDomain(b.web?.uri) - scoreDomain(a.web?.uri))
          .slice(0, 30);
        if (groundingChunks.length) return { ...result, groundingMetadata: { ...result.groundingMetadata, groundingChunks } };
      } catch (error) {
        throw error;
      }
    }
    throw Object.assign(new Error("Google Search Grounding unavailable"), { code: 'GROUNDING_UNAVAILABLE', status: 503 });
  };
}
