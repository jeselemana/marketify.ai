import test from "node:test";
import assert from "node:assert/strict";
import { shouldEnableSearch, evaluateSearchRoute } from "../src/services/ai/search-router.js";

test("shouldEnableSearch returns false for standard copywriting, general concepts, and brainstorming", () => {
  const standardPrompts = [
    "Instagram üçün yeni məhsul haqqında post mətni yaz",
    "Mənə sadə bir email satış şablonu ver",
    "Marketinqdə 4P modeli nədir?",
    "SWOT analizi nə deməkdir?",
    "Kofe brendi üçün 5 dənə kreativ şüar düşün",
    "B2B və B2C marketinqin fərqi nədir?",
    "Müştəri məmnuniyyəti sorğusu üçün suallar hazırla",
    "Yeni kosmetika mağazası üçün ad ideyaları ver",
    "Bu mətni daha rəsmi və cəlbedici tonda yenidən yaz",
    "SEO optimizasiyası necə işləyir?",
  ];

  for (const prompt of standardPrompts) {
    assert.equal(
      shouldEnableSearch(prompt),
      false,
      `Expected "${prompt}" to have search disabled`,
    );
  }
});

test("shouldEnableSearch returns true for competitor analysis and market share queries", () => {
  const competitorPrompts = [
    "Azərbaycanda kofe bazarında əsas rəqiblər kimlərdir?",
    "Rəqib analizi aparmaq üçün rəqiblərimizin təkliflərini araşdır",
    "Lokal bazarda rəqabət mühiti necədir?",
    "Fast food sektorunda əsas rəqiblərin bazar payı nə qədərdir?",
    "Top competitors in Azerbaijani e-commerce market",
  ];

  for (const prompt of competitorPrompts) {
    assert.equal(
      shouldEnableSearch(prompt),
      true,
      `Expected "${prompt}" to have search enabled for competitor analysis`,
    );
  }
});

test("shouldEnableSearch returns true for market prices, costs, and inflation queries", () => {
  const pricePrompts = [
    "Bakıda SMM xidmətlərinin orta bazar qiymətləri nə qədərdir?",
    "Reklam agentliklərinin video çəkiliş üçün qiymət siyahısı",
    "Cari ildə inflasiya və manatın məzənnəsi",
    "Targeting xidmətlərinin aylıq tarifləri nə qədərdir?",
    "Bazar qiyməti neçəyədir?",
  ];

  for (const prompt of pricePrompts) {
    assert.equal(
      shouldEnableSearch(prompt),
      true,
      `Expected "${prompt}" to have search enabled for pricing/market info`,
    );
  }
});

test("shouldEnableSearch returns true for trends, current dates, and news", () => {
  const trendPrompts = [
    "2026-cı ildə rəqəmsal marketinq trendləri hansılardır?",
    "Hazırda TikTok-da hansı trendlər aktualdır?",
    "Bu il Azərbaycanda keçirilən əsas marketinq konfransları və xəbərlər",
    "Son vaxtlar brendinqdə baş verən yeniliklər",
    "Bu gün baş verən son iqtisadi hadisələr və statistika",
  ];

  for (const prompt of trendPrompts) {
    assert.equal(
      shouldEnableSearch(prompt),
      true,
      `Expected "${prompt}" to have search enabled for trends/dates`,
    );
  }
});

test("shouldEnableSearch returns true for URLs, domains, and explicit search intent", () => {
  const searchPrompts = [
    "Bu saytı analiz et: https://marketify.ai",
    "marketify.az saytından məlumatları tap",
    "Google-da axtar gör rəqiblərimiz nə təklif edir",
    "İnternetdə araşdır və mənbələri göstər",
    "Bakıda yerləşən ən yaxşı rəqəmsal agentliklərin ünvanı və əlaqə nömrəsi",
  ];

  for (const prompt of searchPrompts) {
    assert.equal(
      shouldEnableSearch(prompt),
      true,
      `Expected "${prompt}" to have search enabled for URL/search intent`,
    );
  }
});

test("evaluateSearchRoute extracts prompt and returns appropriate route decision", () => {
  const route1 = evaluateSearchRoute({
    prompt: "2026-cı il üçün trendlər",
  });
  assert.equal(route1.enableSearch, true);
  assert.equal(route1.intent, "grounded_search");
  assert.equal(route1.prompt, "2026-cı il üçün trendlər");

  const route2 = evaluateSearchRoute({
    messages: [
      { role: "user", content: "Salam" },
      { role: "assistant", content: "Salam! Necə kömək edə bilərəm?" },
      { role: "user", content: "Mənə sadə bir şüar yaz" },
    ],
  });
  assert.equal(route2.enableSearch, false);
  assert.equal(route2.intent, "standard");
  assert.equal(route2.prompt, "Mənə sadə bir şüar yaz");

  const route3 = evaluateSearchRoute({
    messages: [
      { role: "user", content: "Rəqiblərin qiymətlərini internetdə axtar" },
    ],
  });
  assert.equal(route3.enableSearch, true);
  assert.equal(route3.intent, "grounded_search");

  // When strategy context is attached, internal strategy queries shouldn't trigger external web search
  const routeWithStrategyContext1 = evaluateSearchRoute({
    prompt: "Bu strategiyadakı rəqib analizi və büdcə bölgüsünü izah et",
    hasStrategyContext: true,
  });
  assert.equal(routeWithStrategyContext1.enableSearch, false);
  assert.equal(routeWithStrategyContext1.intent, "standard");

  // When strategy context is attached, explicit search requests SHOULD still trigger web search
  const routeWithStrategyContext2 = evaluateSearchRoute({
    prompt: "İnternetdə axtar və bu saytı yoxla: https://example.com",
    hasStrategyContext: true,
  });
  assert.equal(routeWithStrategyContext2.enableSearch, true);
  assert.equal(routeWithStrategyContext2.intent, "grounded_search");
});
