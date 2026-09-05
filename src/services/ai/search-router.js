/**
 * Dynamic search router module for Gemini 3.7 Flash Google Search Grounding.
 *
 * Intelligently determines whether a user prompt requires real-time web search
 * (market pricing, competitor analysis, current trends, recent dates, URLs, entity lookup)
 * or should bypass search grounding (standard copywriting, general concepts, brainstorming).
 */

const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9-]+\.(?:az|com|org|net|io|co|ai|edu|gov|tr|ru|tech|biz|info|me|app)\b/i;

const REALTIME_TIME_PATTERN = /(?:202[4-9]|203[0-9]|bu\s+il|bu\s+ay|bu\s+h[əe]ft[əe]|bu\s+g[uü]n|cari\s+il|cari\s+ay|son\s+vaxtlar|son\s+aylar|son\s+g[uü]nl[əe]r|haz[ıi]r(?:da|k[ıi])|hal-haz[ıi]r(?:da|k[ıi])|bug[uü]nk[uü]|d[uü]n[əe]n|sabah|current|latest|today|this\s+year|recent|now)/i;

const TRENDS_AND_NEWS_PATTERN = /(?:trend|trendl[əe]r|trendl[əe]ri|yenilik|yenilikl[əe]r|x[əe]b[əe]r|x[əe]b[əe]rl[əe]r|hadis[əe]|hadis[əe]l[əe]r|aktual|statistika|statistikas[ıi]|hesabat|hesabat[ıi]|news|updates|statistics|burax[ıi]l[ıi][sş]\s+tarixi|t[əe]qdimat)/i;

const COMPETITOR_PATTERN = /(?:r[əe]qib|r[əe]qibl[əe]r|r[əe]qibl[əe]rin|r[əe]qibl[əe]ri|r[əe]qab[əe]t|r[əe]qab[əe]t[cç]il|competitor|competitors|competition|bazar\s+pay[ıi]|market\s+share)/i;

const PRICE_AND_MARKET_PATTERN = /(?:qiym[əe]t|qiym[əe]ti|qiym[əe]tl[əe]r|qiym[əe]tl[əe]ri|qiym[əe]tl[əe]ndirm[əe]|bazar\s+qiym[əe]ti|bazar\s+qiym[əe]tl[əe]ri|bazar[ıi]nda|sat[ıi][sş]\s+qiym[əe]t|tarif|tarifl[əe]r|tarifl[əe]ri|m[əe]z[əe]nn[əe]|valyuta|inflyasiya|price|prices|pricing|cost|costs|rate|rates|n[əe]\s+q[əe]d[əe]rdir|ne[cç][əe]y[əe]dir)/i;

const SEARCH_INTENT_PATTERN = /(?:google|axtar|axtar[ıi][sş]|web|internet|sayt|sayt[ıi]|sayt[ıi]ndan|sayt[ıi]nda|m[əe]nb[əe]|m[əe]nb[əe]l[əe]r|m[əe]nb[əe]yi|link|linki|url|onlayn|online|ara[sş]d[ıi]r|ara[sş]d[ıi]rma|tap|lookup|search|browse|find\s+online)/i;

const SPECIFIC_ENTITY_LOOKUP_PATTERN = /(?:hans[ıi]\s+[sş]irk[əe]tl[əe]r|hans[ıi]\s+brendl[əe]r|hans[ıi]\s+ma[gğ]azalar|hans[ıi]\s+agentlikl[əe]r|harada\s+yerl[əe][sş]ir|haradan\s+almaq|[əe]laq[əe]\s+n[oö]mr[əe]si|[uü]nvan[ıi])/i;

const AI_AND_TECH_MODELS_PATTERN = /(?:(?:gemini|gpt|claude|llama|deepseek|mistral|qwen|grok|sora|copilot|chatgpt|openai|anthropic|perplexity|midjourney|dall-?e|runway|elevenlabs)\b|(?:yeni\s+(?:[cç][ıi]xan\s+)?(?:dil\s+)?model[a-zəıiöüçşğ]*|yeni\s+versiya[a-zəıiöüçşğ]*|yeni\s+ai|yeni\s+s[uü]ni\s+intellekt|dil\s+model[a-zəıiöüçşğ]*|g[əe]l[əe]c[əe]k\s+(?:model|burax[ıi]l[ıi][sş])[a-zəıiöüçşğ]*|yeni\s+burax[ıi]l[ıi][sş][a-zəıiöüçşğ]*|texniki\s+yenilik[a-zəıiöüçşğ]*|texnoloji\s+yenilik[a-zəıiöüçşğ]*|benchmark[a-zəıiöüçşğ]*|new\s+model|next\s+model|upcoming\s+model|future\s+release|release\s+date)\b|(?:burax[ıi]l[ıi]b|burax[ıi]lacaq|burax[ıi]l[ıi]bm[ıi]|[cç][ıi]x[ıi]b|[cç][ıi]x[ıi]bm[ıi]|[cç][ıi]xacaq|[cç][ıi]xacaqm[ıi]|[cç][ıi]xan|n[əe]\s+vaxt\s+[cç][ıi]x|when\s+(?:will|did)\s+.*(?:release|launch)|announced|launch(?:ed)?)\b)/i;

const FACT_CHECK_AND_VERIFICATION_PATTERN = /(?:r[əe]smi\s+(?:status|olaraq|elan|a[cç][ıi]qlama|m[əe]lumat)|m[oö]vcuddurmu|m[oö]vcud\s+olub|var\s+ya\s+yox|do[gğ]rudurmu|h[əe]qiq[əe]tdirmi|fakt(?:d[ıi]rm[ıi]|lar)?|d[uü]zg[uü]nd[uü]rm[uü]|yaland[ıi]rm[ıi]|is\s+it\s+true|does\s+it\s+exist|is\s+it\s+real|officially\s+released|official\s+status)/i;

/**
 * Evaluates whether a prompt or query should trigger real-time Google search grounding.
 *
 * @param {string} query The user message or prompt text.
 * @param {object} [options] Optional context configuration.
 * @returns {boolean} True if real-time web search should be enabled.
 */
export function shouldEnableSearch(query = "", options = {}) {
  const text = String(query || "").trim();
  if (!text) return false;

  // 1. Explicit URLs or domain names
  if (URL_PATTERN.test(text)) return true;

  // 2. Explicit search or web retrieval intent
  if (SEARCH_INTENT_PATTERN.test(text)) return true;

  // 3. AI models, new versions, future releases, tech novelties
  if (AI_AND_TECH_MODELS_PATTERN.test(text)) return true;

  // 4. Fact checking, existence checks, official status verification
  if (FACT_CHECK_AND_VERIFICATION_PATTERN.test(text)) return true;

  // 5. Competitor research & market share
  if (COMPETITOR_PATTERN.test(text)) return true;

  // 6. Pricing, rates, currency, inflation
  if (PRICE_AND_MARKET_PATTERN.test(text)) return true;

  // 7. Trends, market news, statistics
  if (TRENDS_AND_NEWS_PATTERN.test(text)) return true;

  // 8. Real-time time triggers (recent dates, current year/month/days)
  if (REALTIME_TIME_PATTERN.test(text)) return true;

  // 9. Specific local entity or business provider lookup
  if (SPECIFIC_ENTITY_LOOKUP_PATTERN.test(text)) return true;

  return false;
}

/**
 * Evaluates the search route for an incoming request.
 *
 * @param {object} params
 * @param {string} [params.prompt] Current user message prompt.
 * @param {Array} [params.messages] Conversation history messages.
 * @param {boolean} [params.hasStrategyContext] Whether a strategy context is attached.
 * @returns {{ enableSearch: boolean, intent: string, prompt: string }}
 */
export function evaluateSearchRoute({ prompt = "", messages = [], hasStrategyContext = false } = {}) {
  const lastUserMsg = typeof prompt === "string" && prompt.trim()
    ? prompt.trim()
    : (Array.isArray(messages) ? messages.filter((m) => m && m.role === "user").at(-1)?.content || "" : "");

  let enableSearch = false;
  if (hasStrategyContext) {
    // When a strategy or task is selected as context, internal terms (competitors, budget, pricing)
    // belong to the strategy document. Only enable live web search if the user explicitly requests
    // online lookup, provides an external URL, or queries external AI models / real-time facts.
    enableSearch = URL_PATTERN.test(lastUserMsg) ||
      SEARCH_INTENT_PATTERN.test(lastUserMsg) ||
      AI_AND_TECH_MODELS_PATTERN.test(lastUserMsg) ||
      FACT_CHECK_AND_VERIFICATION_PATTERN.test(lastUserMsg);
  } else {
    enableSearch = shouldEnableSearch(lastUserMsg);
  }

  return {
    enableSearch,
    intent: enableSearch ? "grounded_search" : "standard",
    prompt: lastUserMsg,
  };
}
