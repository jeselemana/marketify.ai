export const USD_TO_AZN_RATE = 1.70;

const DEFAULT_PRICING = Object.freeze({
  "gemini-3.8-flash": { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  "gemini-3.7-flash": { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  "gpt-5.6-luna": { inputPerMillion: 0.25, outputPerMillion: 1.00 },
  "gpt-5.6-terra": { inputPerMillion: 1.25, outputPerMillion: 5.00 },
});

function getEnvNumber(name, fallback) {
  const val = Number(process.env[name]);
  return Number.isFinite(val) ? val : fallback;
}

export function getPricingForModel(modelName = "") {
  const model = String(modelName || "").toLowerCase().trim();
  const fallback = DEFAULT_PRICING[model] || { inputPerMillion: 0.20, outputPerMillion: 0.80 };

  if (model.includes("luna")) {
    return {
      model,
      inputPerMillion: getEnvNumber("OPENAI_LUNA_INPUT_USD_PER_1M", fallback.inputPerMillion),
      outputPerMillion: getEnvNumber("OPENAI_LUNA_OUTPUT_USD_PER_1M", fallback.outputPerMillion),
    };
  }
  if (model.includes("terra")) {
    return {
      model,
      inputPerMillion: getEnvNumber("OPENAI_TERRA_INPUT_USD_PER_1M", fallback.inputPerMillion),
      outputPerMillion: getEnvNumber("OPENAI_TERRA_OUTPUT_USD_PER_1M", fallback.outputPerMillion),
    };
  }
  if (model.includes("gemini") || model.includes("flash")) {
    return {
      model,
      inputPerMillion: getEnvNumber("GEMINI_FLASH_INPUT_USD_PER_1M", fallback.inputPerMillion),
      outputPerMillion: getEnvNumber("GEMINI_FLASH_OUTPUT_USD_PER_1M", fallback.outputPerMillion),
    };
  }
  return { model, ...fallback };
}

export function calculateEstimatedCost(modelName, inputTokens, outputTokens) {
  const input = Number.isFinite(Number(inputTokens)) ? Math.max(0, Number(inputTokens)) : 0;
  const output = Number.isFinite(Number(outputTokens)) ? Math.max(0, Number(outputTokens)) : 0;

  if (input === 0 && output === 0) {
    return {
      costUsd: 0,
      costAzn: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }

  const rates = getPricingForModel(modelName);
  const costUsd = Number(((input / 1_000_000) * rates.inputPerMillion + (output / 1_000_000) * rates.outputPerMillion).toFixed(6));
  const costAzn = Number((costUsd * USD_TO_AZN_RATE).toFixed(6));

  return {
    costUsd,
    costAzn,
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    pricingSnapshot: rates,
  };
}
