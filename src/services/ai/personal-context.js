const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "but", "can", "for", "from", "how", "into", "our", "that", "the", "their", "this", "what", "when", "with", "your",
  "amma", "artıq", "bir", "biz", "bu", "daha", "də", "edə", "et", "hansı", "ilə", "kimi", "mən", "necə", "nə", "olan", "üçün", "və", "ya",
]);

function tokens(value) {
  return new Set(
    String(value || "")
      .toLocaleLowerCase("az")
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
      .map((token) => token.length > 7 ? token.slice(0, 7) : token) || [],
  );
}

function relevance(queryTokens, value) {
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
    chatRepository.readAll().catch(() => []),
    strategyRepository.readAll().catch(() => []),
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
    const searchable = `${strategy.title || ""} ${strategy.brief || ""}`;
    const score = relevance(queryTokens, searchable);
    if (score > 0) {
      candidates.push({
        score,
        updatedAt: strategy.updatedAt || strategy.createdAt || "",
        label: `Yadda saxlanmış strategiya (${clip(strategy.title, 80) || "strategiya"})`,
        value: clip(strategy.brief),
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
