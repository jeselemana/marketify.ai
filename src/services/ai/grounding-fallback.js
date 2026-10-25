export function ungroundedFallbackConfig(config, instructions, fileGuidance = '') {
  const cleanInstructions = String(instructions || '')
    .replace(/When answering queries regarding new AI models,[^\n]*verify live facts, news, and official announcements\.\n?/gi, '')
    .replace(/\[MANDATORY REAL-TIME SEARCH & TOOL GROUNDING DIRECTIVE\]:[\s\S]*$/i, '')
    .trim();
  const fallback = {
    ...config,
    systemInstruction: `${cleanInstructions}${fileGuidance}\n\nLive Google Search is unavailable for this response. Do not claim to have searched, verified current facts, or consulted live sources. Clearly distinguish supplied context, prior knowledge, estimates and unverified current information. Never invent citations. Answer the user's question thoroughly and helpfully using your existing strategic knowledge, industry benchmarks, and provided context without refusing the request.`,
  };
  delete fallback.tools;
  delete fallback.toolConfig;
  delete fallback.cachedContent;
  return fallback;
}
