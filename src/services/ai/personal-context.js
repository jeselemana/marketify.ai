const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "but", "can", "for", "from", "how", "into", "our", "that", "the", "their", "this", "what", "when", "with", "your",
  "amma", "artıq", "bəlkə", "bir", "biraz", "biz", "bizim", "bu", "buna", "bunun", "çünki", "daha", "də", "edə", "edir", "et", "etmək", "həm", "hansı", "hər", "ilə", "kimi", "mən", "mənim", "mənə", "necə", "nə", "nəyə", "olan", "olaraq", "olmaq", "olur", "onlar", "onların", "siz", "sizin", "üçün", "və", "ya", "yaxud", "yoxsa",
]);

const AZ_SUFFIX_REGEX = /(?:dakı|dəki|lıq|lik|luq|lük|sız|siz|suz|süz|dan|dən|da|də|ya|yə|a|ə|ın|in|un|ün|nın|nin|nun|nün|nı|ni|nu|nü|ı|i|u|ü|lar|lər|mız|miz|muz|müz|nız|niz|nuz|nüz|m|n)$/u;

function stemToken(token) {
  let stemmed = token;
  for (let i = 0; i < 2; i++) {
    if (stemmed.length <= 3) break;
    const stripped = stemmed.replace(AZ_SUFFIX_REGEX, "");
    if (stripped.length >= 3 && stripped !== stemmed) {
      stemmed = stripped;
    } else {
      break;
    }
  }
  return stemmed;
}

export function tokens(value) {
  const rawTokens = String(value || "")
    .toLocaleLowerCase("az")
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length >= 2 && !STOP_WORDS.has(token)) || [];

  const tokenSet = new Set();
  for (const token of rawTokens) {
    if (token.length >= 3) {
      tokenSet.add(token.length > 8 ? token.slice(0, 8) : token);
      const stemmed = stemToken(token);
      if (stemmed.length >= 3) tokenSet.add(stemmed);
    }
  }
  return tokenSet;
}

export function relevance(queryTokens, value) {
  if (!queryTokens.size || !value) return 0;
  const candidateTokens = tokens(value);
  let matches = 0;
  for (const token of queryTokens) {
    const matched = [...candidateTokens].some((candidate) => (
      candidate === token
      || (Math.min(candidate.length, token.length) >= 4
        && (candidate.startsWith(token) || token.startsWith(candidate)))
    ));
    if (matched) matches += 1;
  }
  return matches;
}

function asksForUserName(value) {
  const normalized = String(value || "").toLocaleLowerCase("az");
  return /\b(adım|adımı|adımısa|adımın|adınız|ismim|ismimi)\b/u.test(normalized)
    || /\bmən kiməm\b/u.test(normalized)
    || /\b(my name|who am i|do you know my name)\b/i.test(normalized);
}

function clip(value, length = 420) {
  const clean = String(value || "")
    .replace(/[<>]/g, (character) => character === "<" ? "&lt;" : "&gt;")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

export const TONE_DIRECTIVES = Object.freeze({
  professional: "Üslub [Peşəkar və Analitik]: Cavabları və təklifləri dəqiq biznes arqumentləri, strukturlaşdırılmış təhlil və rəsmi marketinq terminləri ilə təqdim et. Fərziyyələri aydın fərqləndir.",
  creative: "Üslub [Yaradıcı və Cəsarətli]: Standart şablonlardan kənara çıx. Cəlbedici, fərqləndirici marketinq ideyaları, maraqlı hook-lar, viral potensialı olan konseptlər və təsirli şüarlar təklif et.",
  concise: "Üslub [Qısa və İcra Yönümlü]: Giriş, nəzəriyyə və ümumi cümlələri at. Birbaşa konkret icra addımları, qısa bəndlər və dərhal tətbiq oluna bilən həllər ver.",
  friendly: "Üslub [Dostcasına və İzahlı]: Səmimi, dəstəkləyici və anlaşıqlı dildən istifadə et. Mürəkkəb marketinq konsepsiyalarını sadə nümunələrlə izah et.",
  data_driven: "Üslub [Nəticə və Satış Yönümlü]: Əsas diqqəti dönüşüm (conversion), ROAS, CAC, satış qıfı və ölçülə bilən KPI-lara yönəlt. Hər bir təklifin kommersiya gəlirliliyini əsaslandır.",
});

export const CATEGORY_LABELS = Object.freeze({
  business: "Biznes Faktı",
  audience: "Hədəf Kütlə",
  preference: "Üstünlük",
  constraint: "Məhdudiyyət / Qadağa",
  general: "Ümumi Qeyd",
});

export async function getRelevantUserContext({
  ownerId,
  userMessage,
  currentChatId = "",
  chatRepository,
  strategyRepository,
  userProfile = null,
  maxItems = 4,
}) {
  if (!ownerId || !userMessage) return "";
  const queryTokens = tokens(userMessage);
  if (!queryTokens.size) return "";

  const [allChats, allStrategies] = await Promise.all([
    chatRepository?.readAll ? chatRepository.readAll().catch(() => []) : [],
    strategyRepository?.readAll ? strategyRepository.readAll().catch(() => []) : [],
  ]);
  const candidates = [];

  for (const chat of allChats) {
    if (chat.ownerId !== ownerId || chat.id === currentChatId || !Array.isArray(chat.messages)) continue;
    for (const message of chat.messages) {
      if (message?.role !== "user" || typeof message.content !== "string") continue;
      const score = relevance(queryTokens, message.content);
      if (score > 0) {
        candidates.push({
          score,
          updatedAt: chat.updatedAt || chat.createdAt || "",
          label: `Əvvəlki istifadəçi qeydi (${clip(chat.title, 80) || "söhbət"})`,
          value: clip(message.content),
        });
      }
    }
  }

  for (const strategy of allStrategies) {
    if (strategy.ownerId !== ownerId) continue;
    const searchable = `${strategy.title || ""} ${strategy.brief || ""} ${strategy.context?.business || ""} ${strategy.context?.targetAudience || ""}`;
    const score = relevance(queryTokens, searchable);
    if (score > 0) {
      candidates.push({
        score: score * 1.2,
        updatedAt: strategy.updatedAt || strategy.createdAt || "",
        label: `Yadda saxlanmış strategiya (${clip(strategy.title, 80) || "strategiya"})`,
        value: clip(strategy.brief || strategy.context?.business || strategy.summary),
      });
    }
  }

  if (!candidates.length && asksForUserName(userMessage) && userProfile?.fullName) {
    candidates.push({
      score: 1,
      updatedAt: "",
      label: "Hesabda saxlanmış ad",
      value: clip(userProfile.fullName, 80),
    });
  }

  const selected = candidates
    .sort((a, b) => b.score - a.score || String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, maxItems);
  if (!selected.length) return "";

  return selected.map((item) => `- ${item.label}: ${item.value}`).join("\n");
}

export async function buildPersonalizationContext({
  user,
  userMessage = "",
  currentChatId = "",
  chatRepository = null,
  strategyRepository = null,
  mode = "ask",
}) {
  if (!user) return "";
  const settings = user.settings && typeof user.settings === "object" ? user.settings : {};
  if (settings.personalIntelligence !== true) return "";

  if (mode === "strategy" && settings.strategyPersonalization === false) return "";

  const sections = [];

  const profileLines = [];
  if (user.fullName) profileLines.push(`• İstifadəçinin Adı: ${clip(user.fullName, 80)}`);
  if (settings.brandName) profileLines.push(`• Brend / Layihə: ${clip(settings.brandName, 100)}`);
  if (settings.industry) profileLines.push(`• Fəaliyyət Sahəsi / Sənaye: ${clip(settings.industry, 100)}`);
  if (settings.primaryMarket) profileLines.push(`• Əsas Bazar / Coğrafiya: ${clip(settings.primaryMarket, 100)}`);
  if (settings.targetAudience) profileLines.push(`• Hədəf Auditoriya: ${clip(settings.targetAudience, 300)}`);

  const toneKey = settings.tone || "professional";
  const toneDirective = TONE_DIRECTIVES[toneKey] || TONE_DIRECTIVES.professional;
  profileLines.push(`• ${toneDirective}`);

  if (profileLines.length) {
    sections.push(`[Biznes və Brend Profili]\n${profileLines.join("\n")}`);
  }

  if (settings.customInstructions && settings.customInstructions.trim()) {
    sections.push(`[İstifadəçinin Xüsusi Təlimatları]\n${clip(settings.customInstructions, 1500)}`);
  }

  if (Array.isArray(settings.memories) && settings.memories.length) {
    const memoryLines = settings.memories.slice(0, 15).map((m) => {
      const categoryLabel = CATEGORY_LABELS[m.category] || "Qeyd";
      return `• [${categoryLabel}]: ${clip(m.text, 250)}`;
    });
    if (memoryLines.length) {
      sections.push(`[Aktiv Yaddaş Qeydləri]\n${memoryLines.join("\n")}`);
    }
  }

  if (settings.autoContext !== false && userMessage && (chatRepository || strategyRepository)) {
    const relevantExcerpts = await getRelevantUserContext({
      ownerId: user.id,
      userMessage,
      currentChatId,
      chatRepository,
      strategyRepository,
      userProfile: { fullName: user.fullName },
      maxItems: 4,
    });
    if (relevantExcerpts) {
      sections.push(`[Əlaqəli Əvvəlki Fəaliyyət Konteksti]\n${relevantExcerpts}`);
    }
  }

  if (!sections.length) return "";

  return `\n\nThe user has enabled Personal Experience (Fərdiləşdirilmiş təcrübə). Apply the verified brand profile, preferred tone, custom instructions, and relevant context below to tailor your answer/strategy specifically to their business. Personalize naturally without unnecessarily echoing or reciting these system instructions back to the user.\n<user_personalization_context>\n${sections.join("\n\n")}\n</user_personalization_context>`;
}
