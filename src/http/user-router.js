import express from "express";
import { z } from "zod";
import { aiConfig, hasOpenAIConfiguration } from "../services/ai/config.js";
import { getOpenAIClient } from "../services/ai/client.js";
import { LLMProviderError } from "../services/ai/llm-router.js";
import { TONE_DIRECTIVES } from "../services/ai/personal-context.js";

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}

const aiSummaryRateMap = new Map();
const AI_SUMMARY_WINDOW_MS = 10 * 60 * 1000;
const AI_SUMMARY_MAX_PER_WINDOW = 20;

function checkAiSummaryRateLimit(key) {
  const now = Date.now();
  const record = aiSummaryRateMap.get(key) || { count: 0, resetAt: now + AI_SUMMARY_WINDOW_MS };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + AI_SUMMARY_WINDOW_MS;
  }
  record.count += 1;
  aiSummaryRateMap.set(key, record);
  return record.count <= AI_SUMMARY_MAX_PER_WINDOW;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of aiSummaryRateMap.entries()) {
    if (now > record.resetAt) {
      aiSummaryRateMap.delete(key);
    }
  }
}, AI_SUMMARY_WINDOW_MS).unref();

export const AiSummaryRequestSchema = z.object({
  forceRefresh: z.boolean().optional(),
}).strict();

export const AiSummaryOutputSchema = z.object({
  summary: z.string().min(5),
  focusTags: z.array(z.string()).min(1).max(5),
});

export function extractFirstName(name) {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  const first = trimmed.split(/\s+/)[0];
  return first || trimmed;
}

export function buildSystemPrompt({ displayName, language, settings, strategies = [], chats = [], tasks = [] }) {
  const isEn = language === "en";
  const firstName = extractFirstName(displayName) || (isEn ? "Leader" : "Lider");
  const toneKey = settings.tone || "professional";
  const toneDirective = TONE_DIRECTIVES[toneKey] || TONE_DIRECTIVES.professional;

  const profileLines = [];
  if (settings.brandName) profileLines.push(`• Brand: ${settings.brandName}`);
  if (settings.industry) profileLines.push(`• Industry: ${settings.industry}`);
  if (settings.primaryMarket) profileLines.push(`• Market: ${settings.primaryMarket}`);
  if (settings.targetAudience) profileLines.push(`• Target Audience: ${settings.targetAudience}`);
  if (toneDirective) profileLines.push(`• Style Directive: ${toneDirective}`);
  if (settings.customInstructions) profileLines.push(`• Custom Instructions: ${settings.customInstructions}`);

  if (Array.isArray(settings.memories) && settings.memories.length > 0) {
    profileLines.push("• Active Memories: " + settings.memories.slice(0, 10).map((m) => m.text).join(" | "));
  }

  const activityLines = [];
  if (strategies.length > 0) {
    activityLines.push("• Recent Strategies: " + strategies.slice(0, 5).map((s) => `"${s.title || s.summary || "Strategiya"}"`).join(", "));
  }
  if (chats.length > 0) {
    activityLines.push("• Recent Inquiries: " + chats.slice(0, 5).map((c) => `"${c.title || "Söhbət"}"`).join(", "));
  }
  if (tasks.length > 0) {
    activityLines.push("• Planner Tasks: " + tasks.slice(0, 5).map((t) => `"${t.title || "Tapşırıq"}"`).join(", "));
  }

  if (isEn) {
    return `You are Helmer's witty, sharp, and personalized executive account co-pilot.
Your task is to generate a personalized account summary and strategic focus tags for the user with playful teasing and high-energy motivation.

USER PROFILE & IDENTITY:
- Name: ${firstName} (Strictly FIRST NAME only! NEVER use surname or full name!)
- Interface Language: English
${profileLines.length > 0 ? "\nBRAND & PERSONALIZATION PROFILE:\n" + profileLines.join("\n") : ""}
${activityLines.length > 0 ? "\nRECENT ACTIVITY & WORKFLOW CONTEXT:\n" + activityLines.join("\n") : ""}

CRITICAL RULES:
1. ADDRESS BY FIRST NAME ONLY: The summary MUST start by directly addressing the user by their FIRST NAME ONLY ("${firstName}, ..."). NEVER use surnames, full names, or formal titles ("Mr.", "Ms.").
2. TONE & STYLE (PLAYFUL TEASING & WITTY BANTER):
   - NEVER sound dry, corporate, bureaucratic, or like a robotic consultant report.
   - Playfully tease the user ("bir az sataş"): banter about their unstoppable urge to conquer every niche at once, juggle multiple grand ambitions, or over-strategize before pushing to production.
   - Sound like a sharp-witted, hilarious co-founder: lovingly roast them, keep it candid and engaging, yet fiercely validate their ambition and drive them to execute for real revenue.
3. LENGTH: Crisp, punchy, and vibrant, exactly 2 to 3 sentences.
4. FOCUS TAGS: Extract 2 to 3 punchy, memorable strategic focus tags (focusTags) reflecting their immediate growth priorities.
5. FORMAT: Return ONLY valid JSON matching this structure:
{
  "summary": "${firstName}, [playful, witty, lightly teasing, and motivating summary in 2-3 sentences]",
  "focusTags": ["Tag 1", "Tag 2", "Tag 3"]
}`;
  }

  return `Sən Helmer platformasının iti zəkalı, zarafatcıl və fərdiləşdirilmiş hesab yoldaşısan.
Vəzifən istifadəçinin fəaliyyəti əsasında onun üçün canlı, bir az sataşan (playful teasing / witty banter), səmimi və motivasiyaedici hesab xülasəsi və fokus teqləri formalaşdırmaqdır.

İSTİFADƏÇİ PROFİLİ:
- Ad: ${firstName} (Soyad qətiyyən işlədilməməlidir!)
- Dil: Azərbaycan dili
${profileLines.length > 0 ? "\nBREND VƏ FƏRDİLƏŞDİRMƏ PROFİLİ:\n" + profileLines.join("\n") : ""}
${activityLines.length > 0 ? "\nSON FƏALİYYƏT VƏ İŞ AXINI KONTEKSTİ:\n" + activityLines.join("\n") : ""}

MƏCBURİ TƏLƏBLƏR:
1. YALNIZ AD İLƏ BİRBAŞA MÜRACİƏT: Xülasə MÜTLƏQ və İSTİSNASIZ yalnız istifadəçinin İLK ADI ilə başlamalıdır ("${firstName}, ..."). QƏTİYYƏN soyad, tam ad, "bəy", "cənab" və ya rəsmi xitab işlətmə!
2. DİL VƏ ÜSLUB (BİR AZ SATAŞ, SƏMİMİ VƏ CANLI OL):
   - QƏTİYYƏN quru rəsmi, audit hesabatı, korporativ və ya şablon məsləhətçi dili işlətmə! Bu sıxıcı hesabat deyil.
   - İstifadəçiyə bir az sataş (playful teasing, yüngül zarafatla söz atmaq): çoxlu layihələrə və ideyalara baş qoşmasını, dünyanı eyni anda fəth etmək istəyini və ya bəzi planların hələ də icra gözlədiyini zarafatla yada sal.
   - Sanki iti sözlü, səmimi bir dost və ya zarafatcıl co-founder onunla danışır: bir az iynələ, amma eyni zamanda enerjisini qaldır, böyük potensialını vurğula və real gəlirə/icraya fokusla.
3. HƏCM: Dəqiq 2-3 cümləlik kəskin, vurucu, canlı və təbəssüm yaradan xülasə.
4. FOKUS TEQLƏRİ: 2-3 qısa, canlı və diqqət çəkən strateji fokus sahəsi (focusTags).
5. FORMAT: YALNIZ bu JSON strukturunda çıxış ver:
{
  "summary": "${firstName}, [bir az sataşan, səmimi, zarafatcıl və motivasiyaedici 2-3 cümləlik xülasə]",
  "focusTags": ["Teq 1", "Teq 2", "Teq 3"]
}`;
}

export function createUserRouter({ userRepository, strategyRepository, chatRepository, plannerRepository }) {
  const router = express.Router();

  router.post("/ai-summary", asyncRoute(async (req, res) => {
    // 1. Session authentication check
    if (!req.user) {
      return res.status(401).json({
        error: "Sessiya aktiv deyil.",
        code: "AUTH_REQUIRED",
      });
    }

    // 2. Strict payload validation (Rule 2)
    const parseResult = AiSummaryRequestSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.issues[0]?.message || "Sorğu parametrləri düzgün deyil.",
        code: "VALIDATION_ERROR",
      });
    }
    const payload = parseResult.data;

    // 3. Rate limiting check (Rule 6)
    const rateLimitKey = `ai-summary:${req.user.id}:${getClientIp(req)}`;
    if (!checkAiSummaryRateLimit(rateLimitKey)) {
      return res.status(429).json({
        error: "Çox sayda xülasə sorğusu göndərildi. Bir qədər sonra yenidən cəhd edin.",
        code: "RATE_LIMITED",
      });
    }

    // 4. Personalization check (Requirement 1)
    const settings = req.user.settings && typeof req.user.settings === "object" ? req.user.settings : {};
    if (settings.personalIntelligence !== true) {
      return res.status(403).json({
        error: "Fərdiləşdirilmiş xülasə üçün Personalization bölməsindən bu funksiyanı aktivləşdirin",
        code: "PERSONALIZATION_DISABLED",
      });
    }

    // 5. Caching check: Return stored summary if forceRefresh is false
    const rawFullName = (req.user.fullName || "").trim();
    const isStaleFullName = rawFullName.includes(" ") && req.user.aiSummary?.summary?.includes(rawFullName);
    if (!payload.forceRefresh && !isStaleFullName && req.user.aiSummary && typeof req.user.aiSummary === "object" && req.user.aiSummary.summary) {
      return res.json({
        summary: req.user.aiSummary.summary,
        focusTags: Array.isArray(req.user.aiSummary.focusTags) ? req.user.aiSummary.focusTags : [],
        model: req.user.aiSummary.model || aiConfig.accountSummaryModel || "gpt-5.6-luna",
        generatedAt: req.user.aiSummary.generatedAt || req.user.updatedAt || new Date().toISOString(),
        cached: true,
      });
    }

    // 6. Assemble context with strict tenant isolation (Rule 3)
    const userId = req.user.id;
    const [strategies, chats, tasks] = await Promise.all([
      strategyRepository?.readAll
        ? strategyRepository.readAll().then((list) => (list || []).filter((s) => s.ownerId === userId)).catch(() => [])
        : Promise.resolve([]),
      chatRepository?.readAll
        ? chatRepository.readAll().then((list) => (list || []).filter((c) => c.ownerId === userId)).catch(() => [])
        : Promise.resolve([]),
      plannerRepository?.list
        ? plannerRepository.list(userId).catch(() => [])
        : Promise.resolve([]),
    ]);

    const rawDisplayName = (req.user.fullName || req.user.username || "Lider").trim();
    const firstName = extractFirstName(rawDisplayName) || "Lider";
    const language = settings.language === "en" ? "en" : "az";

    const systemPrompt = buildSystemPrompt({
      displayName: firstName,
      language,
      settings,
      strategies,
      chats,
      tasks,
    });

    if (!hasOpenAIConfiguration()) {
      return res.status(503).json({
        error: "OpenAI xidməti konfiqurasiya edilməyib. OPENAI_API_KEY tələb olunur.",
        code: "AI_NOT_CONFIGURED",
      });
    }

    const modelName = aiConfig.accountSummaryModel || "gpt-5.6-luna";

    try {
      const client = getOpenAIClient();
      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: language === "en"
              ? `Generate a witty, playfully teasing, and high-energy account summary for ${firstName}.`
              : `${firstName} üçün bir az sataşan, səmimi və canlı hesab xülasəsini tərtib et.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const rawContent = completion.choices?.[0]?.message?.content?.trim() || "{}";
      let parsed;
      try {
        parsed = JSON.parse(rawContent);
      } catch (jsonErr) {
        throw new LLMProviderError("Model etibarsız JSON cavabı qaytardı.", {
          code: "AI_INVALID_OUTPUT",
          status: 502,
          model: modelName,
          provider: "openai",
          details: jsonErr,
        });
      }

      const validated = AiSummaryOutputSchema.safeParse(parsed);
      if (!validated.success) {
        // Fallback formatting if minor schema mismatch
        parsed = {
          summary: typeof parsed.summary === "string" && parsed.summary.trim()
            ? parsed.summary.trim()
            : `${displayName}, cari strategiya və fəaliyyət axınınız üzrə əsas marketinq prioritetləriniz aktivdir. Fokusunuzu yüksək dönüşümlü satış kanallarına və brend mövqelənməsinə yönəldin.`,
          focusTags: Array.isArray(parsed.focusTags) && parsed.focusTags.length > 0
            ? parsed.focusTags.slice(0, 3)
            : ["Marketinq Strategiyası", "Böyümə Planı", "Biznes İntellekti"],
        };
      } else {
        parsed = validated.data;
      }

      // Ensure direct name prefix
      let summaryText = parsed.summary.trim();
      const namePrefixRegex = new RegExp(`^${displayName}\\b`, "i");
      if (!namePrefixRegex.test(summaryText)) {
        summaryText = `${displayName}, ${summaryText.charAt(0).toLowerCase()}${summaryText.slice(1)}`;
      }

      const cleanTags = (parsed.focusTags || [])
        .map((tag) => String(tag).trim())
        .filter(Boolean)
        .slice(0, 3);

      const aiSummary = {
        summary: summaryText,
        focusTags: cleanTags.length > 0 ? cleanTags : (language === "en" ? ["Strategic Growth", "Brand Optimization"] : ["Strateji Böyümə", "Brend Optimizasiyası"]),
        model: modelName,
        generatedAt: new Date().toISOString(),
      };

      // Persist to user profile
      await userRepository.update(userId, { aiSummary });

      return res.json({
        summary: aiSummary.summary,
        focusTags: aiSummary.focusTags,
        model: aiSummary.model,
        generatedAt: aiSummary.generatedAt,
        cached: false,
      });
    } catch (error) {
      if (error instanceof LLMProviderError) {
        return res.status(error.status || 502).json({
          error: error.message,
          code: error.code || "AI_PROVIDER_ERROR",
        });
      }
      console.error("[AI Summary] Generation error:", error?.message || error);
      return res.status(500).json({
        error: "Xülasəni generasiya etmək mümkün olmadı. Zəhmət olmasa bir qədər sonra yenidən cəhd edin.",
        code: "AI_GENERATION_FAILED",
      });
    }
  }));

  router.get("/ai-summary", asyncRoute(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Sessiya aktiv deyil.", code: "AUTH_REQUIRED" });
    }
    const settings = req.user.settings && typeof req.user.settings === "object" ? req.user.settings : {};
    if (settings.personalIntelligence !== true) {
      return res.status(403).json({
        error: "Fərdiləşdirilmiş xülasə üçün Personalization bölməsindən bu funksiyanı aktivləşdirin",
        code: "PERSONALIZATION_DISABLED",
      });
    }
    if (req.user.aiSummary && typeof req.user.aiSummary === "object" && req.user.aiSummary.summary) {
      return res.json({
        summary: req.user.aiSummary.summary,
        focusTags: Array.isArray(req.user.aiSummary.focusTags) ? req.user.aiSummary.focusTags : [],
        model: req.user.aiSummary.model || aiConfig.accountSummaryModel || "gpt-5.6-luna",
        generatedAt: req.user.aiSummary.generatedAt || req.user.updatedAt || new Date().toISOString(),
        cached: true,
      });
    }
    return res.status(404).json({
      error: "Hələ xülasə generasiya edilməyib.",
      code: "NO_SUMMARY_FOUND",
    });
  }));

  return router;
}
