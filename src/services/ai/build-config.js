// Build has its own contract. Other modes continue using their existing config.
export const buildConfig = Object.freeze({
  routerModel: "gpt-6-luna",
  workhorseModel: "gemini-3.8-flash",
  strategistModel: "gpt-6.1-sol",
  routerTokens: 1800,
  handoffTokens: 6000,
  finalTokens: 16384,
  // Build waits for completion or caller/policy cancellation; no time cutoff.
  maxInputChars: 512000,
  maxOutputChars: 256000,
  routeCacheTtlMs: 300000,
  maxCachedRoutes: 512,
  searchEnabled: process.env.ENABLE_BUILD_SEARCH_GROUNDING !== "false",
});
