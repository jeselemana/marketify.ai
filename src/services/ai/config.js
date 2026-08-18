export const aiConfig = Object.freeze({
  fastModel: process.env.GEMINI_FAST_MODEL || process.env.OPENAI_FAST_MODEL || "gemini-3.7-flash",
  strategyModel: process.env.GEMINI_STRATEGY_MODEL || process.env.OPENAI_STRATEGY_MODEL || "gemini-3.7-flash",
  askModel: process.env.GEMINI_ASK_MODEL || process.env.OPENAI_ASK_MODEL || "gemini-3.7-flash",
  maxClarificationRounds: Number.parseInt(process.env.MAX_CLARIFICATION_ROUNDS || "2", 10),
  assessmentMaxOutputTokens: 2500,
  strategyMaxOutputTokens: 8192,
  refinementMaxOutputTokens: 8192,
});

export function hasGeminiConfiguration() {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim()
  );
}

export function hasOpenAIConfiguration() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function hasAIConfiguration() {
  return hasGeminiConfiguration() || hasOpenAIConfiguration();
}

export function getAIProvider() {
  if (hasGeminiConfiguration()) return "gemini";
  if (hasOpenAIConfiguration()) return "openai";
  return null;
}
