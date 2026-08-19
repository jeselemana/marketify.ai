import test from "node:test";
import assert from "node:assert/strict";
import { getRelevantUserContext } from "../src/services/ai/personal-context.js";

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
