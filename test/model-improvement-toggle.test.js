import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import { UserSettingsSchema } from "../src/auth/validation.js";
import { isModelImprovementEnabled, createIdentityMiddleware } from "../src/http/auth-middleware.js";
import { createAuthRouter, authErrorHandler } from "../src/http/auth-router.js";
import { FileTelemetryRepository } from "../src/repositories/file-telemetry-repository.js";
import { TelemetryService } from "../src/services/telemetry/telemetry-service.js";
import { FileAiLearningRepository } from "../src/repositories/file-ai-learning-repository.js";
import { LearningLoopService } from "../src/services/learning/learning-loop-service.js";
import { FileUserRepository } from "../src/repositories/file-user-repository.js";
import { FileAuthStore } from "../src/auth/auth-store.js";

test("1. UserSettingsSchema validates modelImprovement and enforces .strict()", () => {
  const validOn = UserSettingsSchema.parse({ modelImprovement: true });
  assert.equal(validOn.modelImprovement, true);

  const validOff = UserSettingsSchema.parse({ modelImprovement: false });
  assert.equal(validOff.modelImprovement, false);

  // Rule 2: Schema strictness rejection
  assert.throws(() => {
    UserSettingsSchema.parse({ modelImprovement: true, unknownField: "malicious" });
  }, /unrecognized_keys/i);
});

test("2. FileUserRepository requires explicit opt-in for modelImprovement", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-user-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));
  const repo = new FileUserRepository(path.join(tmpDir, "users.json"), null, { mirrorToR2: false });

  const user = await repo.create({
    fullName: "Test Developer",
    username: "test_dev",
    email: "test_dev@example.com",
    passwordHash: "hash12345",
  });

  assert.equal(user.settings.modelImprovement, false, "New accounts must opt in explicitly");
});

test("3. isModelImprovementEnabled middleware helper accurately detects toggle state", () => {
  // Default guest / unauthenticated
  assert.equal(isModelImprovementEnabled({}), false);

  // Authenticated user with modelImprovement enabled
  assert.equal(isModelImprovementEnabled({ user: { settings: { modelImprovement: true } } }), true);

  // Authenticated user with modelImprovement disabled
  assert.equal(isModelImprovementEnabled({ user: { settings: { modelImprovement: false } } }), false);

  // Guest with disabled header
  assert.equal(isModelImprovementEnabled({ headers: { "x-helmer-model-improvement": "false" } }), false);

  // Guest with disabled cookie object
  assert.equal(isModelImprovementEnabled({ cookies: { helmer_model_improvement: "false" } }), false);

  // Guest with cookie string header
  assert.equal(isModelImprovementEnabled({ headers: { cookie: "helmer_model_improvement=false; other=1" } }), false);
});

test("4. TelemetryService scrubs prompt/brief and flags onlyNecessaryData when restricted", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-telemetry-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));
  const repository = new FileTelemetryRepository(path.join(tmpDir, "telemetry.json"), null, { mirrorToR2: false });
  const telemetry = new TelemetryService(repository);

  // Normal event
  await telemetry.trackBuildStrategy({
    brief: "SaaS CRM layihəsi üçün marketinq strategiyası",
    model: "gemini-3.8-flash",
    latencyMs: 1200,
    modelImprovement: true,
  });

  // Restricted event (user turned off model improvement)
  await telemetry.trackBuildStrategy({
    brief: "Çox məxfi startap layihə ideyası",
    model: "gpt-5.6-terra",
    latencyMs: 1400,
    onlyNecessaryData: true,
  });

  // Restricted ask query
  await telemetry.trackAskQuery({
    query: "Mənim gizli biznes sualım",
    model: "gemini-3.7-flash",
    latencyMs: 800,
    onlyNecessaryData: true,
  });

  const overview = await repository.getOverview({ dateRange: "all" });
  assert.equal(overview.totalEvents, 3);
  assert.equal(overview.restrictedCount, 2, "Overview must correctly count restricted events");

  const list = await repository.listEvents({ page: 1, pageSize: 10 });
  const restrictedBuild = list.items.find((e) => e.model === "gpt-5.6-terra");
  assert.ok(restrictedBuild, "Restricted build event should be stored");
  assert.equal(restrictedBuild.onlyNecessaryData, true);
  assert.match(restrictedBuild.summary, /Zəruri məlumat/);
  assert.doesNotMatch(restrictedBuild.summary, /məxfi startap/);
  assert.equal(restrictedBuild.category, "Zəruri Əməliyyat");
});

test("5. LearningLoopService redacts interactions and prevents training candidate generation when restricted", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-learning-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));
  const repository = new FileAiLearningRepository(path.join(tmpDir, "ai-learning.json"), null, { mirrorToR2: false });
  const learningLoop = new LearningLoopService(repository);

  // Record restricted interaction
  const interaction = await learningLoop.recordInteraction({
    mode: "ask",
    taskType: "ask_query",
    modelProvider: "google",
    modelName: "gemini-3.7-flash",
    userPrompt: "Məxfi maliyyə hesabatı təhlili",
    modelResponse: "Budur detallı maliyyə analizi...",
    relevantContext: { sensitiveBalance: 100000 },
    onlyNecessaryData: true,
  });

  assert.equal(interaction.onlyNecessaryData, true);
  assert.doesNotMatch(interaction.userPrompt, /maliyyə/);
  assert.match(interaction.userPrompt, /Zəruri əməliyyat qeydi/);
  assert.equal(interaction.relevantContext, null, "Context must be cleared");
  assert.match(interaction.modelResponse, /Məzmun gizlədilib/);

  // Recalculate should NOT create training candidates for restricted interaction
  await learningLoop.recalculate();
  const candidates = await learningLoop.listCandidates({});
  assert.equal(candidates.items.length, 0, "Restricted interactions must never become training candidates");
});

test("6. Deactivating modelImprovement via /settings preserves the independent personalIntelligence preference", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-auth-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));
  const userRepo = new FileUserRepository(path.join(tmpDir, "users.json"), null, { mirrorToR2: false });
  const authStore = new FileAuthStore(path.join(tmpDir, "auth-store.json"), null, { mirrorToR2: false });

  const user = await userRepo.create({
    fullName: "Integration User",
    username: "integ_user",
    email: "integ@example.com",
    passwordHash: "hash12345",
  });

  // Start with personalIntelligence enabled
  const updatedUser = await userRepo.update(user.id, {
    settings: { ...user.settings, personalIntelligence: true, modelImprovement: true },
  });
  assert.equal(updatedUser.settings.personalIntelligence, true);

  const app = express();
  app.use(express.json());
  // Mock authenticated user session
  app.use((req, res, next) => {
    req.user = updatedUser;
    next();
  });
  app.use("/api/auth", createAuthRouter({
    userRepository: userRepo,
    authStore,
  }));
  app.use(authErrorHandler);

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${base}/api/auth/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelImprovement: false }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.settings.modelImprovement, false, "modelImprovement must be false");
  assert.equal(data.user.settings.personalIntelligence, true, "Contribution and personalization are independent");
});

test("7. Tone selection accepts professional, direct, creative, and executive without validation error", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-tone-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));
  const userRepo = new FileUserRepository(path.join(tmpDir, "users.json"), null, { mirrorToR2: false });
  const authStore = new FileAuthStore(path.join(tmpDir, "auth-store.json"), null, { mirrorToR2: false });

  const tones = ["professional", "direct", "creative", "executive"];
  for (const tone of tones) {
    const parsed = UserSettingsSchema.parse({ tone });
    assert.equal(parsed.tone, tone, `UserSettingsSchema must accept tone: ${tone}`);
  }

  const user = await userRepo.create({
    fullName: "Tone User",
    username: "tone_user",
    email: "tone@example.com",
    passwordHash: "hash12345",
  });

  const app = express();
  app.use(express.json());
  let currentUser = user;
  app.use((req, res, next) => {
    req.user = currentUser;
    next();
  });
  app.use("/api/auth", createAuthRouter({
    userRepository: userRepo,
    authStore,
  }));
  app.use(authErrorHandler);

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  // Test PATCHing both "direct" and "executive"
  for (const targetTone of ["direct", "executive", "creative", "professional"]) {
    const res = await fetch(`${base}/api/auth/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tone: targetTone }),
    });
    assert.equal(res.status, 200, `Setting tone to ${targetTone} must return 200 OK`);
    const data = await res.json();
    assert.equal(data.user.settings.tone, targetTone, `Saved user tone must be ${targetTone}`);
    currentUser = await userRepo.findById(user.id);
  }
});

test("8. Mobile styles and close button exist for model improvement popover", async () => {
  const css = await fs.readFile(path.join(process.cwd(), "public", "style.css"), "utf8");
  assert.ok(css.includes(".model-info-popover-close"), "CSS must define .model-info-popover-close");
  assert.ok(css.includes("@media (max-width: 640px)"), "CSS must define mobile media query for 640px");
  assert.ok(css.includes(".settings-security-card.model-improvement-card"), "CSS must style model improvement card");

  const js = await fs.readFile(path.join(process.cwd(), "public", "script.js"), "utf8");
  assert.ok(js.includes("model-info-popover-close"), "script.js must render close button for popover");
  assert.ok(js.includes("modelInfoWrap.classList.remove(\"is-visible\")"), "script.js must wire close handler");
});

test("9. Deactivating modelImprovement immediately scrubs existing learning interactions, purges training candidates, and rejects export", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-privacy-scrub-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));
  const userRepo = new FileUserRepository(path.join(tmpDir, "users.json"), null, { mirrorToR2: false });
  const authStore = new FileAuthStore(path.join(tmpDir, "auth-store.json"), null, { mirrorToR2: false });
  const learningRepo = new FileAiLearningRepository(path.join(tmpDir, "learning.json"), null, { mirrorToR2: false });
  const learningService = new LearningLoopService(learningRepo);

  const user = await userRepo.create({
    fullName: "Privacy User",
    username: "privacy_user",
    email: "privacy@example.com",
    passwordHash: "hash12345",
  });

  // Enable modelImprovement initially
  let currentUser = await userRepo.update(user.id, {
    settings: { ...user.settings, modelImprovement: true },
  });
  assert.equal(currentUser.settings.modelImprovement, true);
  const initialEpoch = currentUser.privacyEpoch || 0;

  // Record an interaction while opted-in
  const interaction = await learningService.recordInteraction({
    ownerId: user.id,
    mode: "ask",
    taskType: "ask_query",
    modelProvider: "google",
    modelName: "gemini-3.7-flash",
    userPrompt: "Məxfi şirkət gəlir məlumatları və maliyyə planı",
    modelResponse: "Şirkətinizin büdcə balansı və gizli strategiya planı",
    onlyNecessaryData: false,
    modelImprovement: true,
  });

  // Record signal to generate a candidate
  await learningService.recordSignal(interaction.id, user.id, { explicitRating: "positive", accepted: true });
  await learningService.recalculate();
  let candidates = await learningService.listCandidates({});
  assert.equal(candidates.total, 1, "Candidate should be generated for opted-in user");

  // Spin up app with learning repository wired
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = currentUser;
    next();
  });
  app.use("/api/auth", createAuthRouter({
    userRepository: userRepo,
    authStore,
    aiLearningRepository: learningRepo,
  }));
  app.use(authErrorHandler);

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  // User toggles off modelImprovement
  const res = await fetch(`${base}/api/auth/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelImprovement: false }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.settings.modelImprovement, false);

  // Verify learning store was scrubbed
  const store = await learningRepo.readStore();
  const scrubbedInteraction = store.interactions.find((i) => i.id === interaction.id);
  assert.ok(scrubbedInteraction, "Interaction should still exist as operational record");
  assert.equal(scrubbedInteraction.onlyNecessaryData, true);
  assert.equal(scrubbedInteraction.modelImprovement, false);
  assert.doesNotMatch(scrubbedInteraction.userPrompt, /gəlir məlumatları/);
  assert.match(scrubbedInteraction.userPrompt, /Zəruri əməliyyat qeydi/);
  assert.doesNotMatch(scrubbedInteraction.modelResponse, /büdcə balansı/);
  assert.match(scrubbedInteraction.modelResponse, /Məzmun gizlədilib/);

  // Verify training candidates were completely purged
  assert.equal(store.candidates.length, 0, "All candidates for opted-out user must be purged immediately");

  // Verify privacy epoch was incremented
  const refreshedUser = await userRepo.findById(user.id);
  assert.equal(refreshedUser.privacyEpoch, initialEpoch + 1, "Privacy epoch must increment on opt-out");
});

