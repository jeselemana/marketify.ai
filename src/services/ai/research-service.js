import { privacySnapshot } from "../security/privacy-policy.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { aiConfig, hasGeminiConfiguration, hasOpenAIConfiguration } from "./config.js";
import { getGeminiClient, getOpenAIClient } from "./client.js";
import { extractGroundingSources } from "./strategy-service.js";
import { logWithoutBlocking } from "../learning/learning-loop-service.js";
import { generateSelectiveResearchArtifacts } from "../artifacts/research-artifact-builder.js";

export const CreateResearchJobSchema = z.object({
  prompt: z.string().trim().min(2).max(10000).optional(),
  query: z.string().trim().min(2).max(10000).optional(),
  chatId: z.string().regex(/^[0-9a-f-]{36}$/i).optional(),
  strategyId: z.string().regex(/^[0-9a-f-]{36}$/i).optional(),
  taskId: z.string().regex(/^[0-9a-f-]{36}$/i).optional(),
  language: z.enum(["az", "en"]).optional(),
}).strict().refine((data) => Boolean(data.prompt || data.query), {
  message: "Either prompt or query must be provided",
});

export const LOW_QUALITY_DOMAINS = Object.freeze([
  "quora.com",
  "reddit.com",
  "pinterest.com",
  "buzzfeed.com",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "ehow.com",
  "wikihow.com",
  "answers.com",
  "about.com",
  "tripadvisor.com",
  "yelp.com",
  "teamazing.com",
  "teambuilding.com",
  "medium.com",
  "wordpress.com",
  "blogspot.com",
  "wixsite.com",
  "weebly.com",
  "tumblr.com",
  "hubspot.com",
  "neilpatel.com",
  "semrush.com",
  "ahrefs.com",
  "searchenginejournal.com",
  "searchengineland.com",
  "backlinko.com",
  "ezinearticles.com",
  "articlebiz.com",
  "slideshare.net",
  "scribd.com",
  "issuu.com",
  "patreon.com",
]);

export const HIGH_SIGNAL_DOMAINS = Object.freeze([
  "sec.gov",
  "reuters.com",
  "bloomberg.com",
  "ft.com",
  "wsj.com",
  "marketwatch.com",
  "cnbc.com",
  "investor.google.com",
  "investor.apple.com",
  "ir.aboutamazon.com",
  "semianalysis.com",
  "theinformation.com",
  "stratechery.com",
  "nextplatform.com",
  "anandtech.com",
  "tomshardware.com",
  "servethehome.com",
  "arxiv.org",
  "nature.com",
  "ieee.org",
  "acm.org",
  "science.org",
  "blog.google",
  "research.google",
  "deepmind.google",
  "openai.com",
  "anthropic.com",
  "meta.com",
  "ai.meta.com",
  "aws.amazon.com",
  "azure.microsoft.com",
  "blogs.microsoft.com",
  "developer.nvidia.com",
]);

export function extractCleanDomain(urlOrDomain = "") {
  let str = String(urlOrDomain || "").trim().toLowerCase();
  try {
    if (str.includes("://")) {
      str = new URL(str).hostname;
    }
  } catch {}
  return str.replace(/^www\./, "");
}

const LOW_QUALITY_PATTERNS = Object.freeze([
  /(?:^|\.)blogspot\./i,
  /(?:^|\.)wordpress\./i,
  /(?:^|\.)wixsite\./i,
  /(?:^|\.)weebly\./i,
  /(?:^|\.)tumblr\./i,
]);

export function isLowQualityDomain(urlOrDomain = "") {
  const domain = extractCleanDomain(urlOrDomain);
  if (!domain) return false;
  if (LOW_QUALITY_DOMAINS.some((bad) => domain === bad || domain.endsWith(`.${bad}`))) {
    return true;
  }
  return LOW_QUALITY_PATTERNS.some((pattern) => pattern.test(domain));
}

export function isHighSignalDomain(urlOrDomain = "") {
  const domain = extractCleanDomain(urlOrDomain);
  if (!domain) return false;
  return HIGH_SIGNAL_DOMAINS.some((good) => domain === good || domain.endsWith(`.${good}`));
}

export function scoreDomain(urlOrDomain = "") {
  const domain = extractCleanDomain(urlOrDomain);
  if (!domain) return 0;
  if (isHighSignalDomain(domain)) return 10;
  if (isLowQualityDomain(domain)) return -10;
  return 1;
}

export const RESEARCH_STAGES = Object.freeze([
  {
    key: "plan",
    labelAz: "Mövzu üzrə araşdırma planı hazırlanır…",
    labelEn: "Formulating research plan and decomposition…",
  },
  {
    key: "search",
    labelAz: "Çoxmərhələli paralel axtarışlar icra edilir…",
    labelEn: "Executing multi-step parallel searches…",
  },
  {
    key: "gap_analysis",
    labelAz: "Məlumat boşluqları və göstəricilər çarpaz yoxlanılır…",
    labelEn: "Analyzing research gaps & cross-verifying metrics…",
  },
  {
    key: "synthesize",
    labelAz: "Dərin strateji hesabat sintez olunur…",
    labelEn: "Synthesizing deep strategic findings…",
  },
]);

export function buildResearchPrompt({
  prompt,
  language = "az",
  strategyContext = "",
  taskContext = "",
  gatheredEvidence = "",
}) {
  const isEn = language === "en";
  if (isEn) {
    return {
      systemInstruction: `You are Helmer's Deep Research Engine, a Principal Technology & Financial Strategist operating at CSO / Senior Research Director caliber.
You have real-time access to live Google Search Grounding to inspect current official filings, technical architectures, and financial disclosures.

YOUR MISSION:
Deliver a comprehensive, rigorous, deeply reasoned, and quantitative strategic research report grounded in verified web data.

CRITICAL DEEP REASONING & EXECUTION DIRECTIVES:
1. FULL EXECUTION & COMPLETE DOSSIER MANDATE (STRICT BAN ON PARTIAL HALTING):
   - Fully and exhaustively answer ALL requirements, sections, points, and subheadings provided by the user.
   - If the user provides a multi-point request (e.g. 10 points or N distinct dimensions), systematically generate and render EVERY single section from 1 to the end using structured Markdown headings (##, ###) within this single dossier. Never truncate, omit, or summarize away any requested point.
   - Halting midway, answering only the first item(s), or emitting conversational pauses (e.g. "ready for the next part", "I will pause here for feedback", "shall we proceed to the next step?") is STRICTLY FORBIDDEN. You are an autonomous research engine, not a conversational back-and-forth bot; execute the entire inquiry completely to the end.
2. STRICT BAN ON TEXTBOOK DEFINITIONS & FILLER:
   - Avoid generic textbook definitions, dictionary phrasing, or filler preamble (e.g. "In today's fast-paced world...", "AI is rapidly growing...").
   - Cut straight to strategic reality, hard metrics, and decisive facts.
3. MANDATORY CONCRETE NUMBERS, MARGINS & BENCHMARKS:
   - Do NOT write general qualitative phrases like "significantly cheaper" or "vast improvement".
   - Provide concrete numbers, percentages, CapEx figures, TCO comparisons, FLOP/watt/dollar benchmarks, and operating margin breakdowns.
4. CONTRADICTORY ARGUMENTS & STRUCTURAL TRADE-OFFS:
   - Compare contrasting arguments directly (e.g. how internal TPU silicon deployment reduces GPU dependency vs real net Capex efficiency, custom software ecosystem switching costs, and developer friction).
5. SOURCE QUALITY & STRICT DOMAIN FILTERING:
   - Exclude low-credibility domains like teamazing.com, random personal blogs (wordpress, blogspot), content farms, and SEO platforms from research and citations.
   - Prioritize high-signal domains: SEC filings (10-K, 10-Q), earnings disclosures, premier analysis (SemiAnalysis, Reuters, Bloomberg, The Information, official engineering blogs).
   - Reject clickbait, aggregators, and unverified blogs.
   - Ground major findings contextually: [Domain: Title](URL).
   - Do NOT dump a raw wall of 20+ naked URLs at the end of the text. Primary citations will be neatly presented in the dedicated sources drawer.

REPORT STRUCTURE (PROFESSIONAL MARKDOWN):
- If the user provided numbered points or a multi-part inquiry (e.g. 10 points):
  # [Executive Subject Title]
  Render EVERY requested section systematically:
  ## 1. [Section Title]
  ...
  ## 10. [Section Title]
  Ensure every single section is comprehensively explored with deep data and strategic depth.
- If the user prompt is open-ended:
  # [Executive Title of Research Subject]
  ## 1. Executive Summary
  High-conviction strategic overview uniting core findings, market disbalances, and bottom-line verdict. No preamble.
  ## 2. Quantitative Benchmarks & Cost/Margin Breakdown
  Exact numbers, pricing benchmarks, CapEx figures, unit economics, and margin comparisons in comparative tables or structured metrics.
  ## 3. Architectural Differences & Strategic Trade-offs
  Technical hardware and infrastructure divergence, contrasting viewpoints, and structural friction points.
  ## 4. Strategic Implications & Actionable Decisions
  High-probability strategic opportunities, high-risk blind spots, and concrete next-step recommendations.`,
      userContent: `Conduct Deep Research on this topic. Fully answer all points, sections, and subheadings (e.g. if 10 points are requested, cover each from 1 to 10) in a single exhaustive report without halting or conversational pauses:\n${prompt}${strategyContext}${taskContext}${
        gatheredEvidence ? `\n\n[SYNTHESIZED RESEARCH EVIDENCE ACROSS PIPELINE PHASES]:\n${gatheredEvidence}` : ""
      }`,
    };
  }

  return {
    systemInstruction: `Sən Helmer-in Dərin Araşdırma (Deep Research) mühərrikisən — strateji təhlil və texnoloji-maliyyə araşdırmaları üzrə Baş Strateq (CSO / Principal Analyst) səviyyəsində işləyirsən.
Canlı veb axtarış və Google Search Grounding vasitəsilə ən son rəsmi hesabatlara, texniki arxitekturalara və maliyyə disclosures-ə çıxışın var.

SƏNİN MİSSİYAN:
İstifadəçinin mövzusu üzrə dərindən, hərtərəfli, dəqiq rəqəmlərə və yoxlanılmış mənbələrə əsaslanan yüksək intellektli strateji hesabat hazırlamaq.

CİDDİ DƏRİN TƏHLİL VƏ İCRA TƏLƏBLƏRİ:
1. TAM İCRA VƏ BÜTÖV HESABAT TƏLƏBİ (YARIMÇIQ KƏSİLMƏNİN QARŞISINI AL):
   - İstifadəçinin verdiyi bütün tələbləri, bölmələri və alt-başlıqları tam şəkildə sonuna qədər cavablandır.
   - İstifadəçi çoxbəndli sorğu (məsələn, 10 bənd və ya N sayda bölmə) irəli sürübsə, 1-ci bənddən sonuncu bəndə qədər BÜTÜN 10 bölməni strukturlaşdırılmış Markdown başlığı (##, ###) ilə tam hesabat kimi render et. Heç bir bəndi ötürmə, ixtisar etmə və ya ümumiləşdirmə.
   - Cavabı yarımçıq saxlamaq, "növbəti hissəyə hazıram", "davam etməyə hazıram", "növbəti mərhələlərə keçmək üçün təsdiq gözləyirəm" tipli söhbət frazaları işlətmək QƏTİ QADAĞANDIR. Sən çatbot deyilsən; işi bir dəfəyə, tam və müstəqil şəkildə sonuna qədər bitirən Dərin Araşdırma mühərrikisən.
2. GİRİŞ VƏ TƏRİF QADAĞASI:
   - Ümumi dərslik təriflərindən, lüğət izahlarından və boş giriş cümlələrindən QƏTİ QAÇ ("Bu günün sürətlə inkişaf edən dünyasında...", "Süni intellekt böyük əhəmiyyət kəsb edir..." kimi klişelər YASAQDIR). Birbaşa əsas faktlara, rəqəmlərə və strateji reallığa keç.
3. KONKRET RƏQƏMLƏR, MARJA VƏ BENCHMARK TƏLƏBİ:
   - Ümumi sözlər ("böyük qənaət", "yüksək sürət") əvəzinə MÜTLƏQ konkret rəqəmlər, faizlər, CapEx göstəriciləri, TCO (Total Cost of Ownership), FLOP/dollar səmərəliliyi və marja müqayisələri təqdim et.
4. ZİDDİYYƏTLİ ARQUMENTLƏR VƏ TRADE-OFF ANALİZİ:
   - Tək tərəfli tərif və ya marketinq bəyanatları yazma. Ziddiyyətli arqumentləri və real çətinlikləri dərindən müqayisə et (məsələn: daxili TPU istifadəsinin GPU asılılığını nə dərəcədə azaltdığı, proqram təminatı / CUDA ekosistemindən keçidin gizli xərcləri və real xalis marja qənaəti).
5. MƏNBƏ FİLTRLƏMƏSİ VƏ SİTAT KEYFİYYƏTİ:
   - teamazing.com, təsadüfi bloqlar (wordpress, blogspot və s.), SEO platformaları və marketinq aqreqatorları kimi qeyri-ciddi domenləri axtarışdan və istinadlardan tamamilə kənarlaşdır.
   - Yalnız rəsmi SEC filings (10-K, 10-Q), investor hesabatları, akademik tədqiqatlar və nüfuzlu texnoloji/maliyyə analizlərinə (SemiAnalysis, Reuters, Bloomberg, The Information və rəsmi mühəndislik bloqları) istinad et.
   - Hər bir əsas faktın yanında kontekstual citation saxla ([Domen: Başlıq](URL)).
   - Cavabın sonunda 20-30 linki ard-arda mətn kimi tökmə. Əsas istinadlar interfeys tərəfindən ayrıca açılıb-bağlanan Mənbələr kartında səliqəli şəkildə qruplaşdırılacaq.

HESABATIN STRUKTURU (MARKDOWN):
- Əgər istifadəçi nömrələnmiş konkret bölmələr (məsələn, 10 bənd) tələb edibsə:
  # [Mövzunun İcraçı Başlığı]
  İstifadəçinin tələb etdiyi BÜTÜN bölmələri sırası ilə:
  ## 1. [1-ci Bölmənin Başlığı]
  ...
  ## 10. [10-cu Bölmənin Başlığı]
  (Bütün bəndlər dərin təhlil, konkret rəqəmlər və ziddiyyətli arqumentlərlə tam yazılmalıdır).
- Əgər mövzu sərbəstdirsə:
  # [Araşdırma Mövzusunun İcraçı Başlığı]
  ## 1. Executive Summary (İcraçı Xülasə)
  Ən mühüm strateji tapıntıların, bazar disbalansının və yekun analitik hökmün konspektiv təhlili. Boş giriş olmadan, birbaşa strateji arqumentlə başla.
  ## 2. Rəqəmsal Benchmarklar və Xərc/Marja Müqayisəsi
  Konkret rəqəmlər, qiymət benchmarkları, infrastruktur xərcləri, investisiyalar (CapEx) və marja faizləri.
  ## 3. Texnoloji və Arxitektur Ziddiyyətlər (Trade-off Analizi)
  Daxili arxitektura və aparat təminatı fərqləri. Ziddiyyətli arqumentlərin dərindən toqquşdurulması.
  ## 4. Dərin Strateji Qərarlar və Təsirlər
  Qərarvericilər üçün risklər və yüksək təsirli inkişaf imkanları, konkret icra tövsiyələri.`,
    userContent: `Bu mövzu üzrə dərindən araşdırma apar və ətraflı hesabat tərtib et. İstifadəçinin sorğusundakı bütün tələbləri, bölmələri və alt-başlıqları (məsələn, 10 bənd tələb edilibsə, 1-dən 10-a qədər hər birini) tam və sonuna qədər cavablandır. Cavabı yarımçıq saxlamaq, 'növbəti hissəyə hazıram' tipli söhbət frazaları işlətmək qəti qadağandır:\n${prompt}${strategyContext}${taskContext}${
      gatheredEvidence ? `\n\n[ƏLDƏ EDİLMİŞ DƏRİN TƏDQİQAT FAKTLARI VƏ MƏNBƏLƏR]:\n${gatheredEvidence}` : ""
    }`,
  };
}

export function enrichSourcesFromText(extractedSources = [], markdownText = "") {
  const sources = [];
  const seenUrls = new Set();

  const addSource = (rawTitle, rawUrl, rawDomain) => {
    if (!rawUrl || typeof rawUrl !== "string") return;
    try {
      const parsed = new URL(rawUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) return;
      const cleanUrl = parsed.href;
      if (seenUrls.has(cleanUrl)) return;

      const domain = extractCleanDomain(rawDomain || parsed.hostname);
      if (!domain) return;
      if (isLowQualityDomain(domain)) return;

      seenUrls.add(cleanUrl);
      const isHighSignal = isHighSignalDomain(domain);
      sources.push({
        title: (rawTitle || domain || "Source").slice(0, 200),
        url: cleanUrl,
        domain,
        isHighSignal,
        score: scoreDomain(domain),
      });
    } catch {}
  };

  for (const s of extractedSources) {
    addSource(s.title, s.url, s.domain);
  }

  if (markdownText) {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;
    let match;
    while ((match = linkRegex.exec(markdownText)) !== null) {
      if (sources.length >= 35) break;
      addSource(match[1]?.trim(), match[2]?.trim(), null);
    }
  }

  return sources.sort((a, b) => (b.score || 0) - (a.score || 0));
}

export async function decomposeResearchTopic({
  prompt,
  language = "az",
  geminiClient = null,
  abortSignal = null,
}) {
  const isEn = language === "en";

  const fallbackSubqueries = isEn
    ? [
        {
          query: `${prompt} official reports financial disclosures SEC filings 2025 2026`,
          label: "Investigating official disclosures and SEC filings…",
        },
        {
          query: `${prompt} benchmarks pricing metrics infrastructure costs margin comparisons`,
          label: "Analyzing unit economics, CapEx, and cost benchmarks…",
        },
        {
          query: `${prompt} architecture technical differences structural trade-offs`,
          label: "Comparing technical architecture and infrastructure…",
        },
        {
          query: `${prompt} market dynamics contrasting arguments analysis SemiAnalysis`,
          label: "Evaluating contrasting market perspectives and risks…",
        },
      ]
    : [
        {
          query: `${prompt} rəsmi hesabatlar maliyyə göstəriciləri SEC filings 2025 2026`,
          label: "Rəsmi hesabatlar və maliyyə göstəriciləri araşdırılır…",
        },
        {
          query: `${prompt} xərc analizi qiymət benchmarkları marja göstəriciləri CapEx`,
          label: "Xərc analizi və marja göstəriciləri yoxlanılır…",
        },
        {
          query: `${prompt} texnoloji arxitektura fərqləri infrastruktur müqayisəsi`,
          label: "Arxitektura və infrastruktur fərqləri müqayisə edilir…",
        },
        {
          query: `${prompt} ziddiyyətli arqumentlər bazar analizi SemiAnalysis Reuters`,
          label: "Ziddiyyətli arqumentlər və bazar analizi qiymətləndirilir…",
        },
      ];

  try {
    const decompositionPrompt = isEn
      ? `You are an expert research planner. Decompose this research subject into 3 to 4 distinct, concrete, search-engine-ready sub-queries.
Focus on:
1. Exact numbers, benchmarks, and financial metrics.
2. Official filings, earnings reports, and regulatory disclosures.
3. Architecture, hardware infrastructure, and technical differences.
4. Contrasting arguments and strategic market trade-offs.

Topic: "${prompt}"

Return ONLY a valid JSON array of objects with "query" and "label" properties, for example:
[
  { "query": "exact search keywords", "label": "Short user-facing status description in English (e.g. Investigating TPU vs GPU costs...)" }
]`
      : `Sən tədqiqat planlaşdırıcısısan. Bu araşdırma mövzusunu axtarış sistemləri üçün 3-4 konkret alt-sorğuya parçala:
1. Konkret rəqəmlər, qiymət benchmarkları və maliyyə göstəriciləri.
2. Rəsmi hesabatlar, SEC sənədləri və investor disclosures.
3. Texniki arxitektura və infrastruktur fərqləri.
4. Ziddiyyətli arqumentlər və bazar trade-offları.

Mövzu: "${prompt}"

YALNIZ bu formatda JSON array qaytar:
[
  { "query": "dəqiq axtarış açar sözləri", "label": "İstifadəçi üçün qısa status mətni Azərbaycan dilində (məs. TPU və GPU xərcləri araşdırılır...)" }
]`;

    let responseText = "";
    if (geminiClient || hasGeminiConfiguration()) {
      const client = geminiClient || getGeminiClient();
      const res = await client.models.generateContent(
        {
          model: aiConfig.strategyModel || "gemini-3.8-flash",
          contents: decompositionPrompt,
          config: {
            maxOutputTokens: 1024,
            abortSignal,
          },
        },
        abortSignal ? { signal: abortSignal } : undefined,
      );
      responseText = res?.text?.trim() || "";
    } else if (hasOpenAIConfiguration()) {
      const openai = getOpenAIClient();
      const res = await openai.chat.completions.create(
        {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: decompositionPrompt }],
          max_tokens: 1024,
        },
        abortSignal ? { signal: abortSignal } : undefined,
      );
      responseText = res.choices?.[0]?.message?.content?.trim() || "";
    }

    if (responseText) {
      const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return parsed.slice(0, 4).map((item, idx) => ({
            query: String(item.query || fallbackSubqueries[idx]?.query || prompt).trim(),
            label: String(item.label || fallbackSubqueries[idx]?.label || item.query).trim(),
          }));
        }
      }
    }
  } catch {
    // Fallback on error
  }

  return fallbackSubqueries;
}

export async function executeTargetedSearch({
  query,
  geminiClient = null,
  abortSignal = null,
}) {
  let text = "";
  let sources = [];
  let metadata = null;

  if (geminiClient || hasGeminiConfiguration()) {
    try {
      const client = geminiClient || getGeminiClient();
      const res = await client.models.generateContent(
        {
          model: aiConfig.strategyModel || "gemini-3.8-flash",
          contents: `Search the web thoroughly for: "${query}". Provide verified facts, exact numbers, benchmarks, and citations. Strictly exclude low-credibility sources like teamazing.com, random personal blogs, and marketing/SEO platforms.`,
          config: {
            tools: [{ googleSearch: {} }],
            thinkingConfig: {
              thinkingLevel: "HIGH",
              thinkingBudget: 24576,
            },
            maxOutputTokens: 8192,
            abortSignal,
          },
        },
        abortSignal ? { signal: abortSignal } : undefined,
      );
      text = res?.text?.trim() || "";
      metadata = res?.candidates?.[0]?.groundingMetadata || res?.groundingMetadata;
      const extractedSources = extractGroundingSources(metadata);
      sources = enrichSourcesFromText(extractedSources, text);
      return { text, sources, metadata };
    } catch (err) {
      if (abortSignal?.aborted) throw err;
      console.warn("[Deep Research] Gemini targeted search failed", { code: err?.code || "PROVIDER_ERROR" });
    }
  }

  if (hasOpenAIConfiguration()) {
    try {
      const openai = getOpenAIClient();
      const res = await openai.responses.create(
        {
          model: "gpt-4o",
          instructions: "Search the web for verified facts, numbers, and authoritative sources. Exclude low-credibility domains like teamazing.com, random blogs, or SEO content farms.",
          input: query,
          tools: [{ type: "web_search" }],
          tool_choice: "required",
          max_output_tokens: 4096,
        },
        abortSignal ? { signal: abortSignal } : undefined,
      );
      text = res.output_text?.trim() || "";
      const rawSources = [];
      for (const output of res.output || []) {
        if (output.type === "web_search_call") {
          for (const s of output.action?.sources || []) {
            if (s.url) {
              rawSources.push({ title: s.title, url: s.url });
            }
          }
        }
      }
      sources = enrichSourcesFromText(rawSources, text);
      return { text, sources, metadata: null };
    } catch (err) {
      if (abortSignal?.aborted) throw err;
      console.warn("[Deep Research] OpenAI search failed", { code: err?.code || "PROVIDER_ERROR" });
    }
  }

  return { text: "", sources: [], metadata: null };
}

export async function analyzeResearchGaps({
  prompt,
  gatheredEvidence = "",
  language = "az",
  geminiClient = null,
  abortSignal = null,
}) {
  const isEn = language === "en";
  const fallbackGap = {
    hasGap: true,
    query: `${prompt} exact margin cost numbers vs estimates 2025 2026`,
    label: isEn
      ? "Filling critical data gap on margins & CapEx…"
      : "Marja və xərc üzrə çatışmayan rəqəmlər axtarılır…",
  };

  try {
    const gapPrompt = `You are a strategic research verifier performing Gap Analysis.
User inquiry: "${prompt}"

Current findings summary:
"${(gatheredEvidence || "").slice(0, 3000)}"

Identify if there is any critical missing quantitative metric (margin, CapEx, pricing benchmark) or conflicting assertion that requires a targeted follow-up search.
Return ONLY a JSON object:
{
  "hasGap": true,
  "query": "targeted search query to fill the gap",
  "label": "Short user-facing status in ${isEn ? "English" : "Azerbaijani"}"
}`;

    let responseText = "";
    if (geminiClient || hasGeminiConfiguration()) {
      const client = geminiClient || getGeminiClient();
      const res = await client.models.generateContent(
        {
          model: aiConfig.strategyModel || "gemini-3.8-flash",
          contents: gapPrompt,
          config: { maxOutputTokens: 512, abortSignal },
        },
        abortSignal ? { signal: abortSignal } : undefined,
      );
      responseText = res?.text?.trim() || "";
    } else if (hasOpenAIConfiguration()) {
      const openai = getOpenAIClient();
      const res = await openai.chat.completions.create(
        {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: gapPrompt }],
          max_tokens: 512,
        },
        abortSignal ? { signal: abortSignal } : undefined,
      );
      responseText = res.choices?.[0]?.message?.content?.trim() || "";
    }

    if (responseText) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.hasGap && parsed.query) {
          return {
            hasGap: true,
            query: String(parsed.query).trim(),
            label: String(parsed.label || fallbackGap.label).trim(),
          };
        }
        if (parsed.hasGap === false) {
          return { hasGap: false };
        }
      }
    }
  } catch {
    // Fallback on error
  }

  return fallbackGap;
}

export class ResearchService {
  constructor({
    chatRepository,
    strategyRepository = null,
    plannerRepository = null,
    learningLoop = null,
    telemetryService = null,
    geminiClient = null,
    artifactRepository = null,
  }) {
    this.chatRepository = chatRepository;
    this.strategyRepository = strategyRepository;
    this.plannerRepository = plannerRepository;
    this.learningLoop = learningLoop;
    this.telemetryService = telemetryService;
    this.geminiClient = geminiClient;
    this.artifactRepository = artifactRepository;
    this.activeJobs = new Map();
    this.runningJobPromises = new Set();
  }

  async waitForAllJobs() {
    await Promise.allSettled(Array.from(this.runningJobPromises));
  }

  createInitialSteps(language = "az") {
    const isEn = language === "en";
    const now = new Date().toISOString();
    return RESEARCH_STAGES.map((stage, index) => ({
      key: stage.key,
      label: isEn ? stage.labelEn : stage.labelAz,
      status: index === 0 ? "running" : "pending",
      timestamp: now,
    }));
  }

  async createJob(args) {
    return this.createResearchJob(args);
  }

  async createResearchJob({
    ownerId,
    prompt,
    query,
    chatId = null,
    strategyId = null,
    taskId = null,
    language = "az",
    user = null,
  }) {
    const researchPrompt = (prompt || query || "").trim();
    const isEn = language === "en";
    const jobId = randomUUID();
    const messageId = randomUUID();
    const now = new Date().toISOString();

    let selectedStrategy = null;
    let selectedTask = null;

    if (strategyId && this.strategyRepository) {
      selectedStrategy = await this.strategyRepository.getById(strategyId, ownerId);
    }
    if (taskId && this.plannerRepository) {
      const tasks = await this.plannerRepository.list(ownerId);
      selectedTask = tasks.find((t) => t.id === taskId) || null;
    }

    const strategyContext = selectedStrategy
      ? `\n\n[STRATEGY CONTEXT]:\nTitle: ${selectedStrategy.title}\nBrief: ${JSON.stringify(selectedStrategy.brief || {})}\nStrategy Summary: ${JSON.stringify(selectedStrategy.strategy || {})}`
      : "";
    const taskContext = selectedTask
      ? `\n\n[TASK CONTEXT]:\nTask: ${selectedTask.text}\nGroup: ${selectedTask.groupLabel || "General"}`
      : "";

    const steps = this.createInitialSteps(language);

    const userMessage = {
      role: "user",
      content: researchPrompt,
      strategyTitle: selectedStrategy?.title || undefined,
      taskTitle: selectedTask?.text || undefined,
      createdAt: now,
    };

    const assistantMessage = {
      id: messageId,
      role: "assistant",
      type: "research",
      status: "pending",
      jobId,
      model: "gemini-3.8-flash",
      query: researchPrompt,
      steps,
      sources: [],
      artifacts: [],
      content: "",
      createdAt: now,
      updatedAt: now,
    };

    let existingMessages = [];
    if (chatId) {
      const existingChat = await this.chatRepository.getById(chatId, ownerId);
      if (existingChat) {
        existingMessages = existingChat.messages || [];
      }
    }

    const savedChat = await this.chatRepository.saveChat({
      mustExist: Boolean(chatId),
      id: chatId || undefined,
      ownerId,
      title: existingMessages.length === 0 ? (researchPrompt.length > 50 ? `${researchPrompt.slice(0, 48)}…` : researchPrompt) : undefined,
      messages: [...existingMessages, userMessage, assistantMessage],
      strategyId: strategyId || null,
      taskId: taskId || null,
    });

    const modelImprovement = user?.settings?.modelImprovement === true;

    const job = {
      id: jobId,
      messageId,
      ownerId,
      chatId: savedChat.id,
      prompt: researchPrompt,
      language,
      strategyContext,
      taskContext,
      modelImprovement,
      privacySnapshot: privacySnapshot(user),
      status: "pending",
      steps,
      sources: [],
      artifacts: [],
      groundingMetadata: null,
      content: "",
      error: null,
      createdAt: now,
      updatedAt: now,
      startedAt: Date.now(),
      subscribers: new Set(),
      abortController: new AbortController(),
    };

    this.activeJobs.set(jobId, job);

    if (this.prepareJob) await this.prepareJob(job);

    // Run execution asynchronously in background worker
    const execPromise = (async () => {
      try {
        await this.executeJob(jobId);
      } catch (err) {
        console.error(`[Deep Research] Unhandled worker error for job ${jobId}:`, err);
      }
    })();
    job.executionPromise = execPromise;
    this.runningJobPromises.add(execPromise);
    execPromise.finally(() => {
      this.runningJobPromises.delete(execPromise);
    });

    return {
      jobId,
      chatId: savedChat.id,
      message: assistantMessage,
    };
  }

  async executeJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const isEn = job.language === "en";
    job.abortController.signal.throwIfAborted();
    job.status = "running";
    job.updatedAt = new Date().toISOString();

    const persistAndBroadcast = async (extraData = {}) => {
      job.updatedAt = new Date().toISOString();
      this.broadcast(jobId, {
        type: "step",
        status: job.status,
        steps: job.steps,
        sources: job.sources,
        ...extraData,
      });
      await this.persistJobMessage(job);
    };

    try {
      // ----------------------------------------------------
      // STEP 1: Research Planning & Query Decomposition
      // ----------------------------------------------------
      const planStep = job.steps.find((s) => s.key === "plan") || job.steps[0];
      if (planStep) {
        planStep.status = "running";
        planStep.timestamp = new Date().toISOString();
      }
      await persistAndBroadcast({ currentStep: "plan", stepStatus: "running" });

      const subqueries = await decomposeResearchTopic({
        prompt: job.prompt,
        language: job.language,
        geminiClient: this.geminiClient,
        abortSignal: job.abortController.signal,
      });

      if (planStep) {
        planStep.status = "completed";
        planStep.timestamp = new Date().toISOString();
        planStep.detail = isEn
          ? `${subqueries.length} targeted research dimensions identified`
          : `${subqueries.length} alt-istiqamət müəyyən edildi`;
      }

      // Add dynamic subsearch steps
      const newSteps = [planStep];
      subqueries.forEach((sq, idx) => {
        newSteps.push({
          key: `subsearch_${idx}`,
          label: sq.label,
          query: sq.query,
          status: "pending",
          timestamp: new Date().toISOString(),
        });
      });

      newSteps.push({
        key: "gap_analysis",
        label: isEn
          ? "Analyzing research gaps & missing metrics (Gap Analysis)…"
          : "Məlumat boşluqları və göstəricilər təhlil edilir (Gap Analysis)…",
        status: "pending",
        timestamp: new Date().toISOString(),
      });

      newSteps.push({
        key: "synthesize",
        label: isEn
          ? "Synthesizing deep strategic findings & executive report…"
          : "Dərin strateji hesabat və analitik nəticələr sintez olunur…",
        status: "pending",
        timestamp: new Date().toISOString(),
      });

      job.steps = newSteps;
      await persistAndBroadcast();

      // ----------------------------------------------------
      // STEP 2: Parallel Grounded Searches across Sub-queries
      // ----------------------------------------------------
      const searchResults = await Promise.allSettled(
        subqueries.map(async (sq, idx) => {
          const stepKey = `subsearch_${idx}`;
          const currentSubStep = job.steps.find((s) => s.key === stepKey);
          if (currentSubStep) {
            currentSubStep.status = "running";
            currentSubStep.timestamp = new Date().toISOString();
          }
          await persistAndBroadcast({ currentStep: stepKey, stepStatus: "running" });

          const result = await executeTargetedSearch({
            query: sq.query,
            geminiClient: this.geminiClient,
            abortSignal: job.abortController.signal,
          });

          if (currentSubStep) {
            currentSubStep.status = "completed";
            currentSubStep.timestamp = new Date().toISOString();
            const count = result.sources?.length || 0;
            currentSubStep.detail = count > 0
              ? `${count} ${isEn ? "sources verified" : "mənbə tapıldı"}`
              : (isEn ? "Searched" : "Yoxlanıldı");
          }

          if (result.sources?.length) {
            const seen = new Set(job.sources.map((s) => s.url));
            for (const s of result.sources) {
              if (!seen.has(s.url)) {
                seen.add(s.url);
                job.sources.push(s);
              }
            }
            job.sources.sort((a, b) => (b.score || 0) - (a.score || 0));
            this.broadcast(jobId, { type: "sources", sources: job.sources, count: job.sources.length });
          }

          await persistAndBroadcast({ currentStep: stepKey, stepStatus: "completed" });
          return result;
        }),
      );

      // Collect findings text from all parallel searches
      let collectedEvidence = searchResults
        .filter((r) => r.status === "fulfilled" && r.value?.text)
        .map((r, i) => `### Sub-Research Dimension ${i + 1} (${subqueries[i]?.label}):\n${r.value.text}`)
        .join("\n\n");

      // ----------------------------------------------------
      // STEP 3: Gap Analysis & Follow-Up Targeted Search
      // ----------------------------------------------------
      const gapStep = job.steps.find((s) => s.key === "gap_analysis");
      if (gapStep) {
        gapStep.status = "running";
        gapStep.timestamp = new Date().toISOString();
      }
      await persistAndBroadcast({ currentStep: "gap_analysis", stepStatus: "running" });

      const gapResult = await analyzeResearchGaps({
        prompt: job.prompt,
        gatheredEvidence: collectedEvidence,
        language: job.language,
        geminiClient: this.geminiClient,
        abortSignal: job.abortController.signal,
      });

      if (gapResult.hasGap && gapResult.query) {
        if (gapStep) {
          gapStep.detail = gapResult.label || (isEn ? "Closing data gap…" : "Çatışmayan rəqəmlər axtarılır…");
        }
        await persistAndBroadcast({ currentStep: "gap_analysis", stepStatus: "running" });

        const gapSearch = await executeTargetedSearch({
          query: gapResult.query,
          geminiClient: this.geminiClient,
          abortSignal: job.abortController.signal,
        });

        if (gapSearch.sources?.length) {
          const seen = new Set(job.sources.map((s) => s.url));
          for (const s of gapSearch.sources) {
            if (!seen.has(s.url)) {
              seen.add(s.url);
              job.sources.push(s);
            }
          }
          job.sources.sort((a, b) => (b.score || 0) - (a.score || 0));
          this.broadcast(jobId, { type: "sources", sources: job.sources, count: job.sources.length });
        }

        if (gapSearch.text) {
          collectedEvidence += `\n\n### Gap Analysis Findings (${gapResult.label}):\n${gapSearch.text}`;
        }
      }

      if (gapStep) {
        gapStep.status = "completed";
        gapStep.timestamp = new Date().toISOString();
        gapStep.detail = isEn
          ? "Critical metrics and data gaps verified"
          : "Faktlar və ziddiyyətli arqumentlər çarpaz yoxlanıldı";
      }
      await persistAndBroadcast({ currentStep: "gap_analysis", stepStatus: "completed" });

      // ----------------------------------------------------
      // STEP 4: Deep Strategic Synthesis (Gemini 3.8 Flash High)
      // ----------------------------------------------------
      const synthStep = job.steps.find((s) => s.key === "synthesize");
      if (synthStep) {
        synthStep.status = "running";
        synthStep.timestamp = new Date().toISOString();
      }
      await persistAndBroadcast({ currentStep: "synthesize", stepStatus: "running" });

      const { systemInstruction, userContent } = buildResearchPrompt({
        prompt: job.prompt,
        language: job.language,
        strategyContext: job.strategyContext,
        taskContext: job.taskContext,
        gatheredEvidence: collectedEvidence,
      });

      let rawText = "";
      let metadata = null;
      let primarySucceeded = false;
      let response = null;

      if (hasGeminiConfiguration() || this.geminiClient) {
        try {
          const gemini = this.geminiClient || getGeminiClient();
          response = await gemini.models.generateContent(
            {
              model: aiConfig.strategyModel || "gemini-3.8-flash",
              contents: userContent,
              config: {
                systemInstruction,
                tools: [{ googleSearch: {} }],
                thinkingConfig: {
                  thinkingLevel: "HIGH",
                  thinkingBudget: 24576,
                },
                maxOutputTokens: 16384,
                abortSignal: job.abortController.signal,
              },
            },
            job.abortController ? { signal: job.abortController.signal } : undefined,
          );

          rawText = response?.text?.trim() || "";
          metadata = response?.candidates?.[0]?.groundingMetadata || response?.groundingMetadata;
          const extractedSources = extractGroundingSources(metadata);
          const finalSources = enrichSourcesFromText(extractedSources, rawText);

          const seen = new Set(job.sources.map((s) => s.url));
          for (const s of finalSources) {
            if (!seen.has(s.url)) {
              seen.add(s.url);
              job.sources.push(s);
            }
          }
          job.sources.sort((a, b) => (b.score || 0) - (a.score || 0));
          if (rawText) primarySucceeded = true;
        } catch (geminiError) {
          if (job.abortController?.signal?.aborted) throw geminiError;
          console.warn("[Deep Research] Gemini 3.8 Flash High synthesis error, falling back:", geminiError?.message || geminiError);
        }
      }

      if (!primarySucceeded) {
        if (!hasOpenAIConfiguration()) {
          throw new Error(isEn ? "Research provider is currently unavailable." : "Araşdırma xidməti hazırda əlçatmazdır.");
        }
        const openai = getOpenAIClient();
        response = await openai.responses.create({
          model: "gpt-4o",
          instructions: systemInstruction,
          input: userContent,
          tools: [{ type: "web_search" }],
          tool_choice: "required",
          max_output_tokens: 8192,
        }, job.abortController ? { signal: job.abortController.signal } : undefined);

        rawText = response.output_text?.trim() || "";
        const seen = new Set(job.sources.map((s) => s.url));
        for (const output of response.output || []) {
          if (output.type === "web_search_call") {
            for (const s of output.action?.sources || []) {
              if (s.url && !seen.has(s.url)) {
                try {
                  const parsed = new URL(String(s.url).trim());
                  if (!["http:", "https:"].includes(parsed.protocol)) continue;
                } catch {
                  continue;
                }
                seen.add(s.url);
                const domain = extractCleanDomain(s.url);
                if (!isLowQualityDomain(domain)) {
                  job.sources.push({
                    title: s.title || domain || "Source",
                    url: s.url,
                    domain,
                    isHighSignal: isHighSignalDomain(domain),
                    score: scoreDomain(domain),
                  });
                }
              }
            }
          }
        }
        const textSources = enrichSourcesFromText([], rawText);
        for (const s of textSources) {
          if (!seen.has(s.url)) {
            seen.add(s.url);
            job.sources.push(s);
          }
        }
        job.sources.sort((a, b) => (b.score || 0) - (a.score || 0));
      }

      if (!rawText) {
        throw new Error(isEn ? "Research engine returned an empty response." : "Araşdırma mühərriki boş cavab qaytardı.");
      }

      if (synthStep) {
        synthStep.status = "completed";
        synthStep.timestamp = new Date().toISOString();
        synthStep.detail = isEn ? "Executive report ready" : "Yekun analitik hesabat hazırdır";
      }

      // Mark all steps completed
      for (const step of job.steps) {
        step.status = "completed";
      }

      job.status = "completed";
      job.content = rawText;
      job.groundingMetadata = metadata || undefined;
      job.updatedAt = new Date().toISOString();

      if (this.artifactRepository && job.chatId) {
        try {
          const generatedArtifacts = await generateSelectiveResearchArtifacts({
            job,
            text: rawText,
            artifactRepository: this.artifactRepository,
            signal: job.abortController?.signal,
          });
          job.artifacts = generatedArtifacts || [];
        } catch (artifactErr) {
          console.warn("[Deep Research] Error generating selective artifacts:", artifactErr?.message || artifactErr);
          job.artifacts = [];
        }
      }

      await this.persistJobMessage(job);

      this.broadcast(jobId, {
        type: "done",
        status: "completed",
        reply: rawText,
        sources: job.sources,
        artifacts: job.artifacts || [],
        groundingMetadata: metadata,
        steps: job.steps,
      });

      this.recordCompletion(job, response);
    } catch (error) {
      const isAborted = job.abortController?.signal?.aborted;
      job.status = isAborted ? "cancelled" : "failed";
      job.error = isAborted
        ? (isEn ? "Research was canceled." : "Araşdırma dayandırıldı.")
        : (isEn ? "Research failed." : "Araşdırma zamanı xəta baş verdi.");

      await this.rollbackJobArtifacts(job);

      const currentRunning = job.steps.find((s) => s.status === "running");
      if (currentRunning) currentRunning.status = "failed";

      await this.persistJobMessage(job).catch(() => {});

      this.broadcast(jobId, {
        type: "failed",
        status: "failed",
        error: job.error,
        steps: job.steps,
      });
    } finally {
      // Keep completed/failed job in memory for 1 hour to handle reconnects cleanly
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 60 * 60 * 1000).unref();
    }
  }

  broadcast(jobId, eventData) {
    const job = this.activeJobs.get(jobId);
    if (!job || !job.subscribers?.size) return;

    for (const send of job.subscribers) {
      try {
        send(eventData);
      } catch (err) {
        console.warn("[Deep Research] Error sending to subscriber:", err?.message || err);
      }
    }
  }

  subscribe(jobId, ownerId, onEvent) {
    const job = this.activeJobs.get(jobId);
    if (!job || job.ownerId !== ownerId) return null;

    job.subscribers.add(onEvent);
    return () => {
      job.subscribers.delete(onEvent);
    };
  }

  async getJob(jobId, ownerId) {
    const memoryJob = this.activeJobs.get(jobId);
    if (memoryJob) {
      if (memoryJob.ownerId !== ownerId) return null;
      return {
        id: memoryJob.id,
        chatId: memoryJob.chatId,
        status: memoryJob.status,
        steps: memoryJob.steps,
        sources: memoryJob.sources,
        artifacts: memoryJob.artifacts || [],
        content: memoryJob.content,
        error: memoryJob.error,
        createdAt: memoryJob.createdAt,
        updatedAt: memoryJob.updatedAt,
      };
    }

    // Fall back to chat persistence if job has completed and memory expired
    const allChats = await this.chatRepository.readAll(ownerId);
    const matchingChat = allChats.find((chat) => chat.ownerId === ownerId && chat.messages.some((m) => m.jobId === jobId));
    if (!matchingChat) return null;

    const msg = matchingChat.messages.find((m) => m.jobId === jobId);
    if (!msg) return null;

    return {
      id: jobId,
      chatId: matchingChat.id,
      status: msg.status || "completed",
      steps: msg.steps || [],
      sources: msg.sources || [],
      artifacts: msg.artifacts || [],
      content: msg.content || "",
      error: msg.error || null,
      createdAt: msg.createdAt || matchingChat.createdAt,
      updatedAt: msg.updatedAt || matchingChat.updatedAt,
    };
  }

  async rollbackJobArtifacts(job) {
    if (!this.artifactRepository || !Array.isArray(job?.artifacts) || !job.artifacts.length) return;
    for (const art of [...job.artifacts].reverse()) {
      try {
        if (typeof this.artifactRepository.rollback === "function") {
          await this.artifactRepository.rollback(art, job.ownerId);
        } else if (typeof this.artifactRepository.deleteArtifact === "function") {
          await this.artifactRepository.deleteArtifact(art.id, job.ownerId);
        }
      } catch (err) {
        console.warn("[Deep Research] Error rolling back artifact:", err?.message || err);
      }
    }
    job.artifacts = [];
  }

  async cancelJob(jobId, ownerId) {
    const job = this.activeJobs.get(jobId);
    if (!job || job.ownerId !== ownerId) return false;
    job.abortController.abort();
    await this.rollbackJobArtifacts(job);
    return true;
  }

  async persistJobMessage(job) {
    const isAborted = Boolean(job.abortController?.signal?.aborted);
    const isFailed = ["failed", "cancelled", "interrupted"].includes(job.status) || isAborted;
    if (isFailed) {
      await this.rollbackJobArtifacts(job);
    }
    try {
      const chat = await this.chatRepository.getById(job.chatId, job.ownerId);
      if (!chat) { job.abortController.abort(); throw new Error("Conversation removed"); }

      const msgIdx = chat.messages.findIndex(
        (m) => m.jobId === job.id || (m.role === "assistant" && m.type === "research" && m.id === job.messageId),
      );

      if (msgIdx >= 0) {
        chat.messages[msgIdx] = {
          ...chat.messages[msgIdx],
          type: "research",
          jobId: job.id,
          status: job.status,
          steps: job.steps,
          sources: job.sources,
          artifacts: isFailed ? [] : (job.artifacts || chat.messages[msgIdx].artifacts || []),
          groundingMetadata: job.groundingMetadata || chat.messages[msgIdx].groundingMetadata,
          content: job.content || "",
          error: job.error || undefined,
          updatedAt: job.updatedAt,
        };

        if (this.chatRepository.patchResearchMessage) await this.chatRepository.patchResearchMessage(chat.id, job.ownerId, job.id, chat.messages[msgIdx]);
        else {
        await this.chatRepository.saveChat({
          id: chat.id,
          ownerId: job.ownerId,
          title: chat.title,
          messages: chat.messages,
          strategyId: chat.strategyId,
          taskId: chat.taskId,
          mustExist: true,
          expectedRevision: chat.revision || 1,
        });
        }
      }
    } catch (err) {
      console.error("[Deep Research] Error persisting job message to repository:", err?.message || err);
      await this.rollbackJobArtifacts(job);
      throw err;
    }
  }

  recordCompletion(job, response) {
    if (job.status !== "completed" || job.abortController?.signal?.aborted) return;
    const latencyMs = Date.now() - (job.startedAt || Date.now());
    let usage = null;
    if (response?.usageMetadata) {
      usage = {
        prompt_tokens: response.usageMetadata.promptTokenCount || null,
        completion_tokens: response.usageMetadata.candidatesTokenCount || null,
        total_tokens: response.usageMetadata.totalTokenCount || null,
      };
    }

    const isModelImprovement = job.modelImprovement === true;
    const isRestricted = !isModelImprovement;

    if (this.learningLoop) {
      const interactionId = this.learningLoop.createInteractionId();
      logWithoutBlocking(
        this.learningLoop.recordInteraction({
          id: interactionId,
          ownerId: job.ownerId,
          mode: "ask_research",
          taskType: "deep_research",
          userPrompt: isRestricted ? "[Zəruri əməliyyat qeydi - Məzmun ötürülmür]" : job.prompt,
          relevantContext: isRestricted ? null : { sourcesCount: job.sources?.length || 0 },
          modelProvider: "google",
          modelName: "gemini-3.8-flash",
          modelResponse: isRestricted ? "[Məzmun gizlədilib - Töhfə deaktivdir]" : job.content,
          usage,
          latencyMs,
          requestStatus: "success",
          onlyNecessaryData: isRestricted,
          modelImprovement: isModelImprovement,
          privacySnapshot: job.privacySnapshot,
        }),
        "Deep Research interaction logging",
      );
    }

    if (this.telemetryService) {
      this.telemetryService
        .trackAskQuery({
          ownerId: job.ownerId,
          model: "gemini-3.8-flash-high",
          latencyMs,
          usage,
          groundingActive: true,
          status: "success",
          querySnippet: isRestricted ? "" : job.prompt,
          onlyNecessaryData: isRestricted,
          modelImprovement: isModelImprovement,
          privacySnapshot: job.privacySnapshot,
        })
        .catch(() => {});
    }
  }

  async resumeOrphanedJobs() {
    try {
      const allChats = await this.chatRepository.readAll();
      for (const chat of allChats) {
        if (!chat.messages?.length) continue;
        for (const msg of chat.messages) {
          if (msg.type === "research" && (msg.status === "running" || msg.status === "pending") && msg.jobId) {
            if (!this.activeJobs.has(msg.jobId)) {
              console.log(`[Deep Research] Resuming orphaned job ${msg.jobId} in chat ${chat.id}`);
              const job = {
                id: msg.jobId,
                messageId: msg.id,
                ownerId: chat.ownerId,
                chatId: chat.id,
                prompt: msg.query || chat.title || "",
                modelImprovement: false,
                privacySnapshot: msg.privacySnapshot || { enabled: false, epoch: -1 },
                language: msg.language || "az",
                strategyContext: "",
                taskContext: "",
                status: "running",
                steps: msg.steps || this.createInitialSteps("az"),
                sources: msg.sources || [],
                groundingMetadata: null,
                content: "",
                error: null,
                createdAt: msg.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                startedAt: Date.now(),
                subscribers: new Set(),
                abortController: new AbortController(),
              };
              this.activeJobs.set(msg.jobId, job);
              const resumeExecPromise = (async () => {
                try {
                  await this.executeJob(msg.jobId);
                } catch (err) {
                  console.error(`[Deep Research] Error executing resumed job ${msg.jobId}:`, err);
                }
              })();
              job.executionPromise = resumeExecPromise;
              this.runningJobPromises.add(resumeExecPromise);
              resumeExecPromise.finally(() => {
                this.runningJobPromises.delete(resumeExecPromise);
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn("[Deep Research] Error checking orphaned jobs:", err?.message || err);
    }
  }
}
