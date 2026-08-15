export const aiConfig = Object.freeze({
  fastModel: process.env.OPENAI_FAST_MODEL || "gpt-5.6-terra",
  strategyModel: process.env.OPENAI_STRATEGY_MODEL || "gpt-5.6-terra",
  maxClarificationRounds: Number.parseInt(process.env.MAX_CLARIFICATION_ROUNDS || "2", 10),
  assessmentMaxOutputTokens: 1800,
  strategyMaxOutputTokens: 9000,
  refinementMaxOutputTokens: 9000,
});

export function hasOpenAIConfiguration() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
