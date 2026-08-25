function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const aiConfig = Object.freeze({
  fastModel: process.env.OPENAI_FAST_MODEL || "gpt-5.6-luna",
  strategyModel: process.env.OPENAI_STRATEGY_MODEL || "gpt-5.6-terra",
  askModel: process.env.OPENAI_ASK_MODEL || "gpt-5.6-luna",
  askComplexModel: process.env.OPENAI_ASK_COMPLEX_MODEL || "gpt-5.6-terra",
  askMaxOutputTokens: positiveInteger(process.env.ASK_MAX_OUTPUT_TOKENS, 8192),
  maxClarificationRounds: Number.parseInt(process.env.MAX_CLARIFICATION_ROUNDS || "2", 10),
  assessmentMaxOutputTokens: 1800,
  strategyMaxOutputTokens: 9000,
  refinementMaxOutputTokens: 9000,
  // Build Mode Flagship Models
  defaultBuildModel: "gpt-5.6-terra",
  coreModel: process.env.OPENAI_STRATEGY_MODEL || "gpt-5.6-terra",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.7-flash",
  geminiTemperature: 0.7,
  geminiMaxOutputTokens: 8192,
  geminiThinkingBudget: 0,
});

export function hasOpenAIConfiguration() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function hasGeminiConfiguration() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
