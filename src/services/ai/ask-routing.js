import { shouldEnableSearch } from "./search-router.js";

export function isComplexAskQuery(lastUserMsg = "", hasStrategyContext = false) {
  if (hasStrategyContext) return true;
  const cleanMsg = String(lastUserMsg || "").trim();
  if (cleanMsg.length >= 350) return true;

  return /(hərtərəfli dərin analiz|hərtərəfli analiz|hərtərəfli təhlil|geniş təhlil|rəqib analizi|swot analizi|swot matrisi|audit hesabatı|maliyyə modeli|büdcə bölgüsü|cac\s*\/\s*ltv|tam marketinq planı|daha dərindən düşün|bütün detalları ilə)/i.test(cleanMsg);
}

// Only OpenAI (Luna / Terra) and Gemini 3.7 Flash are accepted routes. Unsupported model
// names fall back to automatic routing instead of granting access.
// File attachments are exclusively handled by Gemini 3.7 Flash multimodal engine.
export function resolveAskModelRoute({ requestedModel = "auto", lastUserMsg = "", hasStrategyContext = false, hasAttachment = false } = {}) {
  if (hasAttachment) {
    return "gemini-3.7-flash";
  }

  const requested = String(requestedModel || "auto").trim().toLowerCase();
  if (requested === "gemini-3.7-flash" || requested === "flash" || requested === "gemini-3.7" || requested === "gemini") {
    return "gemini-3.7-flash";
  }
  if (requested === "terra" || requested.includes("gpt-5.6-terra")) return "terra";
  if (requested === "luna" || requested === "mini" || requested.includes("gpt-5.6-luna")) return "luna";

  // Auto routing: If the query requires live web search grounding (prices, competitors, trends, dates, etc.), route to Gemini 3.7 Flash
  if (shouldEnableSearch(lastUserMsg)) {
    return "gemini-3.7-flash";
  }

  return isComplexAskQuery(lastUserMsg, hasStrategyContext) ? "terra" : "luna";
}
