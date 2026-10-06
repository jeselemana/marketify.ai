import { shouldEnableSearch } from "./search-router.js";

export function isComplexAskQuery(lastUserMsg = "", hasStrategyContext = false) {
  if (hasStrategyContext) return true;
  const cleanMsg = String(lastUserMsg || "").trim();
  if (cleanMsg.length >= 350) return true;

  return /(hərtərəfli dərin analiz|hərtərəfli analiz|hərtərəfli təhlil|geniş təhlil|rəqib analizi|swot analizi|swot matrisi|audit hesabatı|maliyyə modeli|büdcə bölgüsü|cac\s*\/\s*ltv|tam marketinq planı|daha dərindən düşün|bütün detalları ilə)/i.test(cleanMsg);
}

// Ask mode exclusively routes to Gemini 3.8 Flash. GPT models and GPT fallbacks
// are completely eliminated from Ask.
export function resolveAskModelRoute() {
  return "gemini-3.8-flash";
}

// Auto-routing for Gemini 3.8 Flash thinking levels (low, medium, high)
export function resolveAskThinkingLevel({ requestedThinkingLevel = "auto", lastUserMsg = "", hasStrategyContext = false } = {}) {
  const normalized = String(requestedThinkingLevel || "auto").toLowerCase().trim();
  if (["low", "medium", "high", "off"].includes(normalized)) {
    return normalized;
  }
  const cleanMsg = String(lastUserMsg || "").trim();
  if (isComplexAskQuery(cleanMsg, false)) {
    return "high";
  }
  if (
    cleanMsg.length >= 150 ||
    (hasStrategyContext && (cleanMsg.length >= 80 || /(?:strateg|plan|prioritet|qərar|icra|kpi|büdcə|risk|analiz|rəqib|təhlil|istiqamət|decision|metric|budget)/i.test(cleanMsg)))
  ) {
    return "medium";
  }
  return "low";
}
