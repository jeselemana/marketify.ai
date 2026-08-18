export const aiConfig = Object.freeze({
  geminiFlashModel: process.env.GEMINI_FLASH_MODEL || "gemini-3.7-flash",
  openAIBaseFastModel: process.env.OPENAI_FAST_MODEL || "gpt-5.6-terra",
  openAIBaseStrategyModel: process.env.OPENAI_STRATEGY_MODEL || "gpt-5.6-terra",
  openAIBaseAskModel: process.env.OPENAI_ASK_MODEL || Buffer.from("Z3B0LTUuNi1sdW5h", "base64").toString("utf8"), // "gpt-5.6-luna"
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

export function resolveAIModel({ mode = "build", selectedModel = "flash" } = {}) {
  const modelType = String(selectedModel || "flash").trim().toLowerCase();

  if (modelType === "standart" || modelType === "standard") {
    // OpenAI models: Ask uses gpt-5.6-luna, Build uses gpt-5.6-terra
    if (mode === "ask") {
      return {
        provider: "openai",
        model: aiConfig.openAIBaseAskModel,
      };
    }
    return {
      provider: "openai",
      model: aiConfig.openAIBaseStrategyModel,
    };
  }

  // Flash model (Gemini 3.7 Flash for both Ask and Build)
  return {
    provider: hasGeminiConfiguration() ? "gemini" : "openai",
    model: hasGeminiConfiguration()
      ? aiConfig.geminiFlashModel
      : (mode === "ask" ? aiConfig.openAIBaseAskModel : aiConfig.openAIBaseStrategyModel),
  };
}
