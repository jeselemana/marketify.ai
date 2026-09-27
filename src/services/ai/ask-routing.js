import { shouldEnableSearch } from "./search-router.js";

export function isComplexAskQuery(lastUserMsg = "", hasStrategyContext = false) {
  if (hasStrategyContext) return true;
  const cleanMsg = String(lastUserMsg || "").trim();
  if (cleanMsg.length >= 350) return true;

  return /(hərtərəfli dərin analiz|hərtərəfli analiz|hərtərəfli təhlil|geniş təhlil|rəqib analizi|swot analizi|swot matrisi|audit hesabatı|maliyyə modeli|büdcə bölgüsü|cac\s*\/\s*ltv|tam marketinq planı|daha dərindən düşün|bütün detalları ilə)/i.test(cleanMsg);
}

// Only OpenAI (Luna / Terra / Sol) models are accepted routes. Unsupported model
// names fall back to automatic routing instead of granting access.
// File attachments are handled by the gpt-6-sol multimodal engine.
export function resolveAskModelRoute({ requestedModel = "auto", lastUserMsg = "", hasStrategyContext = false, hasAttachment = false } = {}) {
  if (hasAttachment) {
    return "gpt-6-sol";
  }

  const requested = String(requestedModel || "auto").trim().toLowerCase();
  if (requested === "gpt-6-sol" || requested === "sol" || requested === "gemini-3.7-flash" || requested === "flash" || requested === "gemini-3.7" || requested === "gemini") {
    return "gpt-6-sol";
  }
  if (requested === "terra" || requested.includes("gpt-5.6-terra")) return "terra";
  if (requested === "luna" || requested === "mini" || requested.includes("gpt-5.6-luna")) return "luna";

  // Auto routing: If the query requires live web search grounding (prices, competitors, trends, dates, etc.), route to gpt-6-sol
  if (shouldEnableSearch(lastUserMsg)) {
    return "gpt-6-sol";
  }

  return isComplexAskQuery(lastUserMsg, hasStrategyContext) ? "terra" : "luna";
}
