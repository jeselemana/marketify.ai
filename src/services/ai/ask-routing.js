const COMPLEX_QUERY_PATTERN = /(analiz|müqayisə|strategiya|hesabla|büdcə|detallı|plan|təhlil|araşdır|izah et|addım|marketinq|seqment|konversiya|cac|ltv|roi|swot|audit|optimizasiya)/i;

export function routeAskModel({ requestedModel = "auto", messages = [], hasStrategyContext = false } = {}) {
  const normalizedModel = String(requestedModel || "auto").trim().toLowerCase();
  const lastUserMessage = [...messages].reverse().find((message) => message?.role === "user")?.content || "";
  const isComplex = hasStrategyContext ||
    lastUserMessage.length > 150 ||
    messages.length >= 4 ||
    COMPLEX_QUERY_PATTERN.test(lastUserMessage);

  const forceTerra = ["marketify", "terra", "deep"].includes(normalizedModel) || normalizedModel.includes("terra");
  const forceMini = ["mini", "luna"].includes(normalizedModel) || normalizedModel.includes("luna");
  return forceTerra || (!forceMini && isComplex) ? "terra" : "mini";
}
