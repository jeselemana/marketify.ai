import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileAiLearningRepository } from "../src/repositories/file-ai-learning-repository.js";
import { createRequireAdmin } from "../src/http/admin-authorization.js";
import { estimateCost } from "../src/services/learning/config.js";
import { LearningLoopService, logWithoutBlocking } from "../src/services/learning/learning-loop-service.js";
import { calculateQualityScore } from "../src/services/learning/quality-score.js";
import { sanitizeTrainingText } from "../src/services/learning/sanitizer.js";

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-learning-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const repository = new FileAiLearningRepository(path.join(directory, "ai-learning-v1.json"), null, { mirrorToR2: false });
  return { repository, service: new LearningLoopService(repository) };
}

test("sanitization redacts obvious secrets and personal identifiers", () => {
  const result = sanitizeTrainingText("Email me at user@example.com, token Bearer abc.def.ghi and password=hunter22");
  assert.equal(result.containsSensitiveData, true);
  assert.equal(result.status, "redacted");
  assert.doesNotMatch(result.text, /user@example\.com|abc\.def\.ghi|hunter22/);
  assert.match(result.text, /REDACTED_EMAIL/);
});

test("quality scoring gives explicit feedback more weight than implicit copy", () => {
  const copied = calculateQualityScore([{ copied: true }]);
  const positive = calculateQualityScore([{ explicitRating: "positive" }]);
  const negative = calculateQualityScore([{ explicitRating: "negative" }]);
  assert.ok(positive.score > copied.score);
  assert.ok(negative.score < copied.score);
  assert.ok(positive.breakdown.some((item) => item.source === "explicit"));
});

test("cost calculation uses an immutable per-model pricing snapshot", () => {
  const result = estimateCost("model-a", 1_000_000, 500_000, [{ model: "model-a", inputPerMillion: 2, outputPerMillion: 8 }]);
  assert.equal(result.estimatedCost, 6);
  assert.deepEqual(result.pricingSnapshot, { model: "model-a", inputPerMillion: 2, outputPerMillion: 8 });
  assert.equal(estimateCost("unknown", 100, 100, []).estimatedCost, null);
});

test("interaction, signal, candidate review, pagination, filters and approved-only export", async (t) => {
  const { service } = await fixture(t);
  const first = await service.recordInteraction({
    id: service.createInteractionId(), ownerId: "user-1", mode: "ask", taskType: "ask_general",
    userPrompt: "Contact user@example.com with the launch plan", modelProvider: "openai", modelName: "test-model",
    modelResponse: "Use a three-step launch plan.", usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
    latencyMs: 250, requestStatus: "success",
  });
  await service.recordInteraction({
    id: service.createInteractionId(), ownerId: "user-2", mode: "build", taskType: "build_generate",
    userPrompt: "Build a plan", modelProvider: "openai", modelName: "test-model",
    modelResponse: "Plan", latencyMs: 500, requestStatus: "success",
  });

  assert.equal((await service.listCandidates()).total, 0, "raw interactions are not auto-approved or auto-candidates");
  await service.recordSignal(first.id, "user-1", { explicitRating: "positive", accepted: true });
  await service.recordSignal(first.id, "user-1", { copied: true });
  const candidates = await service.listCandidates({ status: "pending" }, 1, 1);
  assert.equal(candidates.total, 1);
  assert.equal(candidates.items[0].containsSensitiveData, true);
  assert.doesNotMatch(candidates.items[0].sanitizedInput, /user@example\.com/);
  assert.equal(await service.exportApproved(), "");

  await service.reviewCandidate(candidates.items[0].id, "approved", "admin-1");
  const rejectedSource = await service.recordInteraction({
    ownerId: "user-3", mode: "ask", taskType: "ask_general", userPrompt: "Second question",
    modelProvider: "openai", modelName: "test-model", modelResponse: "Second answer", requestStatus: "success",
  });
  await service.recordSignal(rejectedSource.id, "user-3", { explicitRating: "positive" });
  const rejectedCandidate = (await service.listCandidates({ status: "pending" })).items[0];
  await service.reviewCandidate(rejectedCandidate.id, "rejected", "admin-1");
  const exported = await service.exportApproved();
  const sample = JSON.parse(exported.trim());
  assert.equal(sample.messages[0].role, "user");
  assert.equal(sample.messages[1].role, "assistant");
  assert.equal(sample.metadata.source, "helmer");

  const askOnly = await service.listInteractions({ mode: "ask" }, 1, 1);
  assert.equal(askOnly.total, 2);
  assert.equal(askOnly.items.length, 1);
  assert.equal((await service.overview()).approvedSamples, 1);
  assert.equal(exported.trim().split("\n").length, 1, "rejected samples are excluded from export");
  assert.equal((await service.modelPerformance())[0].requestCount, 3);
});

test("learning persistence failure remains fail-open for the primary response", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const primaryResponse = { reply: "Valid AI response" };
    logWithoutBlocking(Promise.reject(new Error("storage unavailable")), "test logging");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(primaryResponse.reply, "Valid AI response");
  } finally {
    console.error = originalError;
  }
});

test("response iterations preserve modification request and preferred output", async (t) => {
  const { service } = await fixture(t);
  const interaction = await service.recordInteraction({
    ownerId: "user-1", mode: "build", taskType: "build_generate", userPrompt: "Create a strategy",
    modelProvider: "openai", modelName: "test-model", modelResponse: "Version one", requestStatus: "success",
  });
  await service.recordIteration({
    parentInteractionId: interaction.id, ownerId: "user-1", modificationRequest: "Azərbaycan bazarına uyğunlaşdır",
    response: "Azərbaycan üçün version two", finalAccepted: true,
  });
  const detail = await service.getInteraction(interaction.id);
  assert.equal(detail.iterations.length, 1);
  assert.equal(detail.iterations[0].iterationNumber, 1);
  assert.equal(detail.preferredResponse, "Azərbaycan üçün version two");
});

test("admin authorization accepts configured identities and masks the API for non-admins", () => {
  const middleware = createRequireAdmin(new Set(["admin@example.com"]));
  let nextCalled = false;
  middleware({ user: { email: "ADMIN@example.com" }, method: "GET", accepts: () => false }, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  let statusCode = null;
  let payload = null;
  const response = { status(code) { statusCode = code; return this; }, json(value) { payload = value; return this; } };
  middleware({ user: { email: "member@example.com" }, method: "GET", accepts: () => false }, response, () => {});
  assert.equal(statusCode, 404);
  assert.equal(payload.code, "NOT_FOUND");
});

test("learning repository cascades account deletion across raw and training layers", async (t) => {
  const { repository, service } = await fixture(t);
  const interaction = await service.recordInteraction({ ownerId: "delete-me", mode: "ask", userPrompt: "Question", modelResponse: "Answer", requestStatus: "success" });
  await service.recordSignal(interaction.id, "delete-me", { explicitRating: "positive" });
  assert.equal(await repository.deleteAllByOwner("delete-me"), 1);
  const store = await repository.readStore();
  assert.equal(store.interactions.length, 0);
  assert.equal(store.signals.length, 0);
  assert.equal(store.candidates.length, 0);
});
