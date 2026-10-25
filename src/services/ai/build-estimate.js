import { z } from "zod";

export const BuildEstimateRequestSchema = z.object({
  brief: z.string().trim().min(8).max(8000),
}).strict();

// Estimates are display guidance, never execution deadlines. The classifier is
// Luna; the server owns the range and the requested conservative upper buffer.
export function preparationEstimateForRoute(route) {
  let minMinutes, baseMaxMinutes;
  if (route.complexity === "small") { minMinutes = 1; baseMaxMinutes = 2; }
  else if (route.complexity === "complex") { minMinutes = 4; baseMaxMinutes = 8; }
  else if (route.reasoning === "high") { minMinutes = 3; baseMaxMinutes = 5; }
  else { minMinutes = 2; baseMaxMinutes = route.reasoning === "low" ? 3 : 4; }
  if (route.googleSearch || route.solWebSearch) { minMinutes += 1; baseMaxMinutes += 2; }
  const bufferMinutes = route.complexity === "small" ? 2 : 3;
  return Object.freeze({ minMinutes, maxMinutes: baseMaxMinutes + bufferMinutes, bufferMinutes });
}

export function buildRoutingInput({ brief, answers = [], assumptions = [] }) {
  return JSON.stringify({ brief: brief.trim(), answers, assumptions });
}
