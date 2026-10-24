export function ungroundedFallbackConfig(config, instructions, fileGuidance = '') {
  const fallback = { ...config, systemInstruction: `${instructions}${fileGuidance}\n\nLive Google Search is unavailable for this response. Do not claim to have searched, verified current facts, or consulted live sources. Clearly distinguish supplied context, prior knowledge, estimates and unverified current information. Never invent citations.` };
  delete fallback.tools;
  delete fallback.toolConfig;
  delete fallback.cachedContent;
  return fallback;
}
