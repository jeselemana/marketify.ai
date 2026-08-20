function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const aiConfig = Object.freeze({
  fastModel: process.env.OPENAI_FAST_MODEL || "gpt-5.6-terra",
  strategyModel: process.env.OPENAI_STRATEGY_MODEL || "gpt-5.6-terra",
  // Ask routes between Luna/Mini and the Marketify-branded Terra experience.
  askModel: process.env.OPENAI_ASK_MODEL || "gpt-5.6-terra",
  askTerraModel: process.env.OPENAI_ASK_TERRA_MODEL || process.env.OPENAI_ASK_MODEL || "gpt-5.6-terra",
  askMiniModel: process.env.OPENAI_ASK_MINI_MODEL || "gpt-5.6-luna",
  // Ask is a real-time chat surface. Keeping its prompt and answer bounded is
  // important for time-to-first-token, especially on a shared API quota.
  askHistoryMessages: positiveInteger(process.env.ASK_HISTORY_MESSAGES, 8),
  askMaxOutputTokens: positiveInteger(process.env.ASK_MAX_OUTPUT_TOKENS, 2500),
  maxClarificationRounds: Number.parseInt(process.env.MAX_CLARIFICATION_ROUNDS || "2", 10),
  assessmentMaxOutputTokens: 1800,
  strategyMaxOutputTokens: 9000,
  refinementMaxOutputTokens: 9000,
});

export function hasOpenAIConfiguration() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
