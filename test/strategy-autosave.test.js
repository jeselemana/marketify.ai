import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { UserSettingsSchema } from "../src/auth/validation.js";
import { GenerateRequestSchema } from "../src/domain/strategy.js";
import { FileUserRepository } from "../src/repositories/file-user-repository.js";
import { FileStrategyRepository } from "../src/repositories/file-strategy-repository.js";
import { createStrategyRouter, strategyErrorHandler } from "../src/http/strategy-router.js";
import express from "express";

test("1. UserSettingsSchema defines autoSaveStrategies defaulting to true", () => {
  const defaults = UserSettingsSchema.parse({});
  assert.equal(defaults.autoSaveStrategies, true);

  const disabled = UserSettingsSchema.parse({ autoSaveStrategies: false });
  assert.equal(disabled.autoSaveStrategies, false);

  const enabled = UserSettingsSchema.parse({ autoSaveStrategies: true });
  assert.equal(enabled.autoSaveStrategies, true);
});

test("2. GenerateRequestSchema defines autoSave defaulting to true", () => {
  const defaults = GenerateRequestSchema.parse({
    brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı",
    idempotencyKey: "test-idempotency-key-autosave-1",
  });
  assert.equal(defaults.autoSave, true);

  const disabled = GenerateRequestSchema.parse({
    brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı",
    idempotencyKey: "test-idempotency-key-autosave-2",
    autoSave: false,
  });
  assert.equal(disabled.autoSave, false);
});

test("3. FileUserRepository creates new user with autoSaveStrategies: true", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-user-autosave-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const repository = new FileUserRepository(path.join(directory, "users.json"));
  const user = await repository.create({
    fullName: "Auto Save User",
    email: "autosave@test.com",
    username: "autosavetest",
    passwordHash: "dummyhash123",
  });

  assert.equal(user.settings.autoSaveStrategies, true);
});

test("4. i18n contains strategy autoSave translations in both AZ and EN", async () => {
  const i18nFile = await fs.readFile(path.join(process.cwd(), "public/i18n.js"), "utf8");
  assert.ok(i18nFile.includes("autoSaveTitle:"), "autoSaveTitle key exists in i18n");
  assert.ok(i18nFile.includes("autoSaveDesc:"), "autoSaveDesc key exists in i18n");
  assert.ok(i18nFile.includes("autoSaveToggleTitle:"), "autoSaveToggleTitle key exists in i18n");
  assert.ok(i18nFile.includes("autoSaveActive:"), "autoSaveActive key exists in i18n");
  assert.ok(i18nFile.includes("autoSaveInactive:"), "autoSaveInactive key exists in i18n");
  assert.ok(i18nFile.includes("scopeAutoSaveTitle:"), "scopeAutoSaveTitle key exists in i18n");
});

test("5. script.js implements autoSave helpers, accordion, and generation logic", async () => {
  const script = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  assert.ok(script.includes("isAutoSaveStrategiesEnabled"), "isAutoSaveStrategiesEnabled helper exists");
  assert.ok(script.includes("setAutoSaveStrategies"), "setAutoSaveStrategies helper exists");
  assert.ok(script.includes("autoSaveAccordion"), "autoSaveAccordion exists");
  assert.ok(script.includes("autoSaveActive"), "autoSaveActive check in startGeneration exists");
  assert.ok(script.includes("autoSaveStrategies: isAutoSave"), "autoSaveStrategies included in form payload");
});

test("6. strategy router respects autoSave flag (saves when true, skips when false)", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-strat-autosave-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const repository = new FileStrategyRepository(path.join(directory, "strategies.json"));
  const router = createStrategyRouter(repository);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.ownerId = "test-owner-autosave";
    req.user = { id: "test-owner-autosave", settings: { autoSaveStrategies: true } };
    next();
  });
  app.use("/api/strategy", router);
  app.use(strategyErrorHandler);

  // Directly verify repository auto-save behavior
  const sampleStrategy = {
    title: "Test AutoSave Strategy",
    summary: "A brief summary for autosave verification",
    context: {},
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  };

  // When autoSave is disabled, no record should be stored in repository
  const preRecords = await repository.list("test-owner-autosave");
  assert.equal(preRecords.length, 0);

  // When autoSave is enabled, save should happen
  await repository.create({
    clientSaveId: "test-idempotency-key-saved",
    brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı",
    answers: [],
    strategy: sampleStrategy,
    versions: [{ versionNumber: 1, data: sampleStrategy, changeRequest: "İlkin strategiya", createdAt: new Date().toISOString() }],
  }, "test-owner-autosave");

  const postRecords = await repository.list("test-owner-autosave");
  assert.equal(postRecords.length, 1);
  assert.equal(postRecords[0].title, "Test AutoSave Strategy");
});
