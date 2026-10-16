/**
 * Dynamic search router module for Gemini 3.8 Flash Google Search Grounding.
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

const EXPLICIT_WEB_LOOKUP_PATTERN = /(?:google(?:-da)?\s+axtar|internet(?:d[əe])?\s+(?:axtar|ara[sş]d[ıi]r)|sayt[ıi]ndan|sayt[ıi]n[ıi]\s+(?:analiz|yoxla)|web(?:-d[əe])?\s+axtar|m[əe]nb[əe]l[əe]ri\s+g[oö]st[əe]r|search\s+online|find\s+online|look\s+up\s+on\s+the\s+web)/i;

const SEARCH_INTENT_PATTERN = /(?:google|axtar|axtar[ıi][sş]|web|internet|sayt|sayt[ıi]|sayt[ıi]ndan|sayt[ıi]nda|m[əe]nb[əe]|m[əe]nb[əe]l[əe]r|m[əe]nb[əe]yi|link|linki|url|onlayn|online|ara[sş]d[ıi]r|ara[sş]d[ıi]rma|tap|lookup|search|browse|find\s+online)/i;

const SPECIFIC_ENTITY_LOOKUP_PATTERN = /(?:hans[ıi]\s+[sş]irk[əe]tl[əe]r|hans[ıi]\s+brendl[əe]r|hans[ıi]\s+ma[gğ]azalar|hans[ıi]\s+agentlikl[əe]r|harada\s+yerl[əe][sş]ir|haradan\s+almaq|[əe]laq[əe]\s+n[oö]mr[əe]si|[uü]nvan[ıi])/i;

const AI_AND_TECH_MODELS_PATTERN = /(?:(?:gemini|gpt|claude|llama|deepseek|mistral|qwen|grok|sora|copilot|chatgpt|openai|anthropic|perplexity|midjourney|dall-?e|runway|elevenlabs)\b|(?:yeni\s+(?:[cç][ıi]xan\s+)?(?:dil\s+)?model[a-zəıiöüçşğ]*|yeni\s+versiya[a-zəıiöüçşğ]*|yeni\s+ai|yeni\s+s[uü]ni\s+intellekt|dil\s+model[a-zəıiöüçşğ]*|g[əe]l[əe]c[əe]k\s+(?:model|burax[ıi]l[ıi][sş])[a-zəıiöüçşğ]*|yeni\s+burax[ıi]l[ıi][sş][a-zəıiöüçşğ]*|texniki\s+yenilik[a-zəıiöüçşğ]*|texnoloji\s+yenilik[a-zəıiöüçşğ]*|benchmark[a-zəıiöüçşğ]*|new\s+model|next\s+model|upcoming\s+model|future\s+release|release\s+date)\b|(?:burax[ıi]l[ıi]b|burax[ıi]lacaq|burax[ıi]l[ıi]bm[ıi]|[cç][ıi]x[ıi]b|[cç][ıi]x[ıi]bm[ıi]|[cç][ıi]xacaq|[cç][ıi]xacaqm[ıi]|[cç][ıi]xan|n[əe]\s+vaxt\s+[cç][ıi]x|when\s+(?:will|did)\s+.*(?:release|launch)|announced|launch(?:ed)?)\b)/i;

const FACT_CHECK_AND_VERIFICATION_PATTERN = /(?:r[əe]smi\s+(?:status|olaraq|elan|a[cç][ıi]qlama|m[əe]lumat)|m[oö]vcuddurmu|m[oö]vcud\s+olub|var\s+ya\s+yox|do[gğ]rudurmu|h[əe]qiq[əe]tdirmi|fakt(?:d[ıi]rm[ıi]|lar)?|d[uü]zg[uü]nd[uü]rm[uü]|yaland[ıi]rm[uü]|is\s+it\s+true|does\s+it\s+exist|is\s+it\s+real|officially\s+released|official\s+status)/i;

/**
 * Contextual guard for conceptual questions, copywriting, internal business brainstorming,
 * formulas, and general marketing advice that happen to contain broad words like
 * "qiymət", "rəqib", "hazırda", "bu gün", "sayt", "tap", "hesabat".
 */
const CONCEPTUAL_OR_COPYWRITING_GUARD_PATTERN = /(?:(?:\bpost\b|m[əe]tn[a-zəıiöüçşğ]*|şablon[a-zəıiöüçşğ]*|email|m[əe]ktub|elan|başlıq[a-zəıiöüçşğ]*|şüar[a-zəıiöüçşğ]*|slogan|ssenari|script|reklam\s+m[əe]tni|kopiraytinq|copywriting|caption|bio|hekay[əe]|story|ideya[a-zəıiöüçşğ]*|ad\s+ideya|ad\s+tap|başlıq\s+tap|ideya\s+tap|d[əe]y[əe]r\s+t[əe]klifi|\busp\b)\b.*(?:\byaz|yaza\s+bil[əe]r[əe]m|\bhaz[ıi]rla|\bver|\bd[uü]ş[uü]n|\bt[əe]klif\s+et|\byarat|\bqur|\btap\b)|\b(?:n[əe]\s+dem[əe]kdir|n[əe]dir|nec[əe]\s+hesablan[ıi]r|nec[əe]\s+qurulur|nec[əe]\s+yaz[ıi]l[ıi]r|nec[əe]\s+apar[ıi]l[ıi]r|d[uü]sturu\s+n[əe]dir|f[əe]rqi\s+n[əe]dir|nec[əe]\s+i[sş]l[əe]yir|n[əe]z[əe]riyy[əe]si|metodologiyas[ıi]|prinsipl[əe]ri|mərhələləri\s+hansılardır|addımları\s+hansılardır|üçün\s+suallar\s+hazırla)\b|\b(?:qiym[əe]tl[əe]ndirm[əe]\s+strategiyas[ıi]|qiym[əe]t\s+strategiyas[ıi]|qiym[əe]t\s+psixologiyas[ıi]|r[əe]qibl[əe]rd[əe]n\s+f[əe]rql[əe]nm[əe]k|r[əe]qab[əe]t\s+üstünlüyü\s+nədir|r[əe]qib\s+analizi\s+nec[əe]\s+apar[ıi]l[ıi]r|sayt\s+struktur[uü]|sayt\s+üçün\s+m[əe]tn|hesabat\s+şablonu|hesabat\s+forması|öz\s+biznesim\s+üçün|biznesimiz\s+üçün\s+ideya)\b)/i;

const HARD_EXTERNAL_REALTIME_FACT_PATTERN = /(?:202[4-9]|203[0-9]|\b(?:az[əe]rbaycan(?:da|ın)?|bak[ıi](?:da|nın)?)\b.*(?:r[əe]qib|qiym[əe]t|bazar\s+pay[ıi]|tarif|x[əe]b[əe]r|konfrans|agentlik)|bazar\s+qiym[əe]t[a-zəıiöüçşğ]*|orta\s+bazar\s+qiym[əe]t|qiym[əe]t\s+siyah[ıi]s[ıi]|ayl[ıi]q\s+tarifl[əe]r|n[əe]\s+q[əe]d[əe]rdir|ne[cç][əe]y[əe]dir|m[əe]z[əe]nn[əe][a-zəıiöüçşğ]*|inflyasiya|inflasiya|bazar\s+pay[ıi]|market\s+share|top\s+competitors|əsas\s+r[əe]qibl[əe]r\s+kiml[əe]rdir|r[əe]qibl[əe]rimizin\s+t[əe]klifl[əe]rini\s+ara[sş]d[ıi]r|r[əe]qab[əe]t\s+m[uü]hiti\s+nec[əe]dir|aktuald[ıi]r|iqtisadi\s+hadis[əe]l[əe]r)/i;

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

  // 1. Explicit URLs or domain names always trigger search
  if (URL_PATTERN.test(text)) return true;

  // 2. Explicit web/Google search directive always triggers search
  if (EXPLICIT_WEB_LOOKUP_PATTERN.test(text)) return true;

  // 3. AI models, new versions, future releases, tech novelties always trigger search
  if (AI_AND_TECH_MODELS_PATTERN.test(text)) return true;

  // 4. Fact checking, existence checks, official status verification always trigger search
  if (FACT_CHECK_AND_VERIFICATION_PATTERN.test(text)) return true;

  // 5. Specific local entity or business provider lookup (addresses, phone numbers, which companies)
  if (SPECIFIC_ENTITY_LOOKUP_PATTERN.test(text)) return true;

  // 6. Contextual negative guard: if the user is asking for conceptual explanations, formulas,
  // copywriting, templates, or internal brainstorming without requesting hard external market facts,
  // bypass Google Search so TTFT stays ultra-fast.
  if (CONCEPTUAL_OR_COPYWRITING_GUARD_PATTERN.test(text) && !HARD_EXTERNAL_REALTIME_FACT_PATTERN.test(text)) {
    return false;
  }

  // 7. Explicit search or web retrieval intent
  if (SEARCH_INTENT_PATTERN.test(text)) {
    // Guard against generic "ad tap", "ideya tap", "sayt üçün başlıq" when no external lookup is intended
    if (/\b(?:ad|ideya|şüar|başlıq|mövzu|həll|format|üslub|söz)\s+tap\b/i.test(text) && !HARD_EXTERNAL_REALTIME_FACT_PATTERN.test(text)) {
      return false;
    }
    if (/\bsayt\s+(?:üçün|mətni|strukturu|dizaynı|konsepti|açmaq|yaratmaq)\b/i.test(text) && !HARD_EXTERNAL_REALTIME_FACT_PATTERN.test(text)) {
      return false;
    }
    return true;
  }

  // 8. Competitor research & market share
  if (COMPETITOR_PATTERN.test(text)) return true;

  // 9. Pricing, rates, currency, inflation
  if (PRICE_AND_MARKET_PATTERN.test(text)) return true;

  // 10. Trends, market news, statistics
  if (TRENDS_AND_NEWS_PATTERN.test(text)) return true;

  // 11. Real-time time triggers (recent dates, current year/month/days)
  if (REALTIME_TIME_PATTERN.test(text)) {
    // Guard against conversational "hazırda öz biznesim üçün...", "bu gün bir post yaz"
    if (/\b(?:hazırda|hal-hazırda|bu\s+gün|indi)\b/i.test(text) && !HARD_EXTERNAL_REALTIME_FACT_PATTERN.test(text) && !TRENDS_AND_NEWS_PATTERN.test(text) && !PRICE_AND_MARKET_PATTERN.test(text) && !COMPETITOR_PATTERN.test(text)) {
      return false;
    }
    return true;
  }

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
      EXPLICIT_WEB_LOOKUP_PATTERN.test(lastUserMsg) ||
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
