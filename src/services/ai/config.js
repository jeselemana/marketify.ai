function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const aiConfig = Object.freeze({
  fastModel: process.env.OPENAI_FAST_MODEL || "gpt-5.6-terra",
  strategyModel: process.env.OPENAI_STRATEGY_MODEL || "gpt-5.6-terra",
  askModel: process.env.OPENAI_ASK_MODEL || "gpt-5.6-luna",
  geminiAskModel: process.env.GEMINI_ASK_MODEL || "gemini-3.7-flash",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  // Ask is a real-time chat surface. Keeping its prompt and answer bounded is
  // important for time-to-first-token, especially on a shared API quota.
  geminiAskHistoryMessages: positiveInteger(process.env.GEMINI_ASK_HISTORY_MESSAGES, 10),
  geminiAskMaxOutputTokens: positiveInteger(process.env.GEMINI_ASK_MAX_OUTPUT_TOKENS, 8192),
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
