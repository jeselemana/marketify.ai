function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const aiConfig = Object.freeze({
  strategyModel: process.env.GEMINI_STRATEGY_MODEL || process.env.STRATEGY_MODEL || "gemini-3.8-flash",
  strategyFallbackModel: process.env.OPENAI_STRATEGY_MODEL || "gpt-5.6-terra",
  strategyThinkingLevel: process.env.GEMINI_STRATEGY_THINKING_LEVEL || "HIGH",
  askModel: process.env.OPENAI_ASK_MODEL || "gpt-5.6-luna",
  askComplexModel: process.env.OPENAI_ASK_COMPLEX_MODEL || "gpt-5.6-terra",
  askGeminiModel: process.env.GEMINI_ASK_MODEL || "gemini-3.7-flash",
  geminiThinkingBudget: process.env.GEMINI_THINKING_BUDGET !== undefined
    ? Number.parseInt(process.env.GEMINI_THINKING_BUDGET, 10)
    : -1,
  geminiMaxOutputTokens: positiveInteger(process.env.GEMINI_MAX_OUTPUT_TOKENS, 65536),
  askMaxOutputTokens: positiveInteger(process.env.ASK_MAX_OUTPUT_TOKENS, 8192),
  maxClarificationRounds: Number.parseInt(process.env.MAX_CLARIFICATION_ROUNDS || "2", 10),
  assessmentMaxOutputTokens: 1800,
  strategyMaxOutputTokens: 9000,
  refinementMaxOutputTokens: 9000,
});

export function hasOpenAIConfiguration() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function hasGeminiConfiguration() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
