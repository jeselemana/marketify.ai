import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPersonalizationContext,
  getRelevantUserContext,
  tokens,
  relevance,
  TONE_DIRECTIVES,
} from "../src/services/ai/personal-context.js";
import { UserSettingsSchema, AddMemoryItemSchema } from "../src/auth/validation.js";

function repository(records) {
  return { readAll: async () => records };
}

test("personal context returns only relevant, owner-scoped saved context", async () => {
  const chatRepository = repository([
    {
      id: "chat-owner",
      ownerId: "user-a",
      title: "Instagram planı",
      updatedAt: "2026-08-10T00:00:00.000Z",
      messages: [{ role: "user", content: "Instagram reklamlarında əsas məqsədimiz e-ticarət ROAS göstəricisini artırmaqdır." }],
    },
    {
      id: "chat-other-user",
      ownerId: "user-b",
      title: "Gizli plan",
      updatedAt: "2026-08-11T00:00:00.000Z",
      messages: [{ role: "user", content: "Instagram reklam büdcəmiz tam məxfidir." }],
    },
    {
      id: "current-chat",
      ownerId: "user-a",
      title: "Cari söhbət",
      messages: [{ role: "user", content: "Instagram üçün cari sual təkrarı." }],
    },
  ]);
  const strategyRepository = repository([
    { ownerId: "user-a", title: "SEO strategiyası", brief: "Orqanik axtarış trafiki", updatedAt: "2026-08-09T00:00:00.000Z" },
    { ownerId: "user-b", title: "Instagram sirri", brief: "Başqa istifadəçinin məlumatı" },
  ]);

  const context = await getRelevantUserContext({
    ownerId: "user-a",
    userMessage: "Instagram reklam ROAS nəticəsini necə yaxşılaşdıraq?",
    currentChatId: "current-chat",
    chatRepository,
    strategyRepository,
  });

  assert.match(context, /e-ticarət ROAS/);
  assert.doesNotMatch(context, /tam məxfidir|Başqa istifadəçinin|cari sual təkrarı/);
  assert.doesNotMatch(context, /SEO strategiyası/);
});

test("personal context stays empty when saved data is unrelated", async () => {
  const context = await getRelevantUserContext({
    ownerId: "user-a",
    userMessage: "Instagram reklamları",
    chatRepository: repository([{ ownerId: "user-a", messages: [{ role: "user", content: "Komanda işə qəbulu" }] }]),
    strategyRepository: repository([]),
  });
  assert.equal(context, "");
});

test("personal context matches Azerbaijani name suffixes across chats", async () => {
  const context = await getRelevantUserContext({
    ownerId: "user-a",
    userMessage: "Adımı bilirsən?",
    chatRepository: repository([{
      id: "old-chat",
      ownerId: "user-a",
      title: "Tanışlıq",
      messages: [{ role: "user", content: "Mənim adım Cesurdur." }],
    }]),
    strategyRepository: repository([]),
    userProfile: { fullName: "Hesab Adı" },
  });

  assert.match(context, /Mənim adım Cesurdur/);
  assert.doesNotMatch(context, /Hesab Adı/);
});

test("name questions use the authenticated profile only as a relevant fallback", async () => {
  const repositories = {
    chatRepository: repository([]),
    strategyRepository: repository([]),
  };
  const nameContext = await getRelevantUserContext({
    ownerId: "user-a",
    userMessage: "Adımı bilirsən?",
    userProfile: { fullName: "Cesur Elemana" },
    ...repositories,
  });
  const unrelatedContext = await getRelevantUserContext({
    ownerId: "user-a",
    userMessage: "Instagram reklamlarını necə yaxşılaşdıraq?",
    userProfile: { fullName: "Cesur Elemana" },
    ...repositories,
  });

  assert.match(nameContext, /Cesur Elemana/);
  assert.equal(unrelatedContext, "");
});

test("Azerbaijani stemmer and token matcher correctly links inflected words", () => {
  const queryTokens = tokens("mağazamıza");
  const text = "Yeni mağaza açılışı və marketinq tədbirləri";
  const score = relevance(queryTokens, text);
  assert.ok(score > 0, "Stemmer should link 'mağazamıza' and 'mağaza'");
});

test("buildPersonalizationContext compiles full brand profile, tone directives, custom instructions, and memories", async () => {
  const user = {
    id: "usr-123",
    fullName: "Cesur Elemana",
    settings: {
      personalIntelligence: true,
      brandName: "Marketify AI",
      industry: "B2B SaaS & Marketing",
      primaryMarket: "Azərbaycan və Qlobal",
      targetAudience: "Startaplar, agentliklər və biznes sahibləri",
      tone: "concise",
      customInstructions: "Həmişə büdcəyə qənaət edən kanalları tövsiyə et və cavabı addım-addım qur.",
      memories: [
        { id: "mem-1", text: "Biz yalnız B2B şirkətlərlə işləyirik.", category: "business", createdAt: "2026-08-15T00:00:00Z" },
        { id: "mem-2", text: "Ənənəvi TV/Radio reklamları istifadə etmirik.", category: "constraint", createdAt: "2026-08-15T00:00:00Z" },
      ],
      autoContext: true,
      strategyPersonalization: true,
    },
  };

  const chatRepo = repository([
    {
      id: "c-1",
      ownerId: "usr-123",
      title: "SaaS Böyümə",
      messages: [{ role: "user", content: "SaaS müştəri cəlb etmə xərclərini (CAC) necə optimallaşdıraq?" }],
    },
  ]);

  const context = await buildPersonalizationContext({
    user,
    userMessage: "CAC göstəricisini azaltmaq üçün hansı addımları ataq?",
    chatRepository: chatRepo,
    strategyRepository: repository([]),
    mode: "ask",
  });

  assert.match(context, /<user_personalization_context>/);
  assert.match(context, /Marketify AI/);
  assert.match(context, /B2B SaaS & Marketing/);
  assert.match(context, /Azərbaycan və Qlobal/);
  assert.match(context, /Qısa və İcra Yönümlü/);
  assert.match(context, /Həmişə büdcəyə qənaət edən kanalları/);
  assert.match(context, /Biz yalnız B2B şirkətlərlə işləyirik/);
  assert.match(context, /Məhdudiyyət \/ Qadağa/);
  assert.match(context, /Ənənəvi TV\/Radio reklamları/);
  assert.match(context, /SaaS müştəri cəlb etmə/);
});

test("buildPersonalizationContext returns empty if personalIntelligence is disabled", async () => {
  const user = {
    id: "usr-disabled",
    fullName: "Test User",
    settings: {
      personalIntelligence: false,
      brandName: "Gizli Brend",
    },
  };

  const context = await buildPersonalizationContext({
    user,
    userMessage: "Sual",
  });
  assert.equal(context, "");
});

test("buildPersonalizationContext respects strategyPersonalization flag for strategy mode", async () => {
  const user = {
    id: "usr-strat-off",
    fullName: "Strategy Off",
    settings: {
      personalIntelligence: true,
      strategyPersonalization: false,
      brandName: "Brand Off",
    },
  };

  const stratContext = await buildPersonalizationContext({
    user,
    userMessage: "Strategiya brifi",
    mode: "strategy",
  });
  assert.equal(stratContext, "");

  const askContext = await buildPersonalizationContext({
    user,
    userMessage: "Strategiya brifi",
    mode: "ask",
  });
  assert.match(askContext, /Brand Off/);
});

test("UserSettingsSchema and AddMemoryItemSchema validation works correctly", () => {
  const validSettings = UserSettingsSchema.parse({
    personalIntelligence: true,
    brandName: "Test Co",
    tone: "creative",
    memories: [{ id: "m1", text: "Fakt", category: "preference", createdAt: "2026-08-20" }],
  });
  assert.equal(validSettings.brandName, "Test Co");
  assert.equal(validSettings.tone, "creative");
  assert.equal(validSettings.memories.length, 1);

  const memory = AddMemoryItemSchema.parse({ text: "Qeyd mətni", category: "business" });
  assert.equal(memory.text, "Qeyd mətni");
  assert.equal(memory.category, "business");
});

