import { learningConfig } from "./config.js";

function contribution(label, value, source, strength) {
  return { label, value, source, strength };
}

export function calculateQualityScore(signals = [], iterations = [], weights = learningConfig.weights) {
  const latest = signals.reduce((state, signal) => ({ ...state, ...signal }), {});
  const breakdown = [contribution("Neutral baseline", weights.baseline, "system", "neutral")];

  if (latest.explicitRating === "positive") breakdown.push(contribution("Explicit positive feedback", weights.explicitPositive, "explicit", "strong"));
  if (latest.explicitRating === "negative") breakdown.push(contribution("Explicit negative feedback", weights.explicitNegative, "explicit", "strong"));
  if (latest.accepted === true) breakdown.push(contribution("Result accepted", weights.accepted, "behavior", "medium"));
  if (latest.copied === true) breakdown.push(contribution("Result copied", weights.copied, "behavior", "weak"));
  if (latest.regenerated === true) breakdown.push(contribution("Result regenerated", weights.regenerated, "behavior", "medium"));
  if (latest.edited === true) breakdown.push(contribution("Result edited", weights.edited, "behavior", "weak"));

  const correctionCount = iterations.filter((item) => item.modificationRequest).length;
  if (correctionCount) breakdown.push(contribution(`${correctionCount} correction request(s)`, weights.correction * correctionCount, "iteration", "weak"));
  if (iterations.some((item) => item.finalAccepted === true)) {
    breakdown.push(contribution("Successful final iteration", weights.successfulFinalIteration, "iteration", "medium"));
  }

  const raw = breakdown.reduce((sum, item) => sum + item.value, 0);
  return { score: Number(Math.max(0, Math.min(1, raw)).toFixed(4)), breakdown };
}
