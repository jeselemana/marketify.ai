import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileStrategyRepository } from "../src/repositories/file-strategy-repository.js";

function sampleStrategy(title = "Restaurant growth") {
  return {
    title,
    summary: "A focused strategy summary.",
    context: {
      business: "A burger restaurant",
      objective: "Increase weekday delivery orders",
      market: "Badamdar, Baku",
      targetAudience: "People aged 18–30",
    },
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  };
}

test("strategy records are owner-scoped and duplicate saves are idempotent", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "marketify-test-"));
  const repository = new FileStrategyRepository(path.join(directory, "strategies.json"));
  const strategy = sampleStrategy();
  const payload = {
    clientSaveId: "client-save-123",
    brief: "Build a strategy for my restaurant.",
    answers: [],
    strategy,
    versions: [
      {
        versionNumber: 1,
        data: strategy,
        changeRequest: "Initial strategy",
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const created = await repository.create(payload, "owner-a");
  const duplicate = await repository.create(payload, "owner-a");

  assert.equal(created.id, duplicate.id);
  assert.equal(await repository.getById(created.id, "owner-b"), null);
  assert.equal((await repository.list("owner-b")).length, 0);
  assert.equal((await repository.list("owner-a")).length, 1);
});

test("a saved refinement appends a non-destructive version", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "marketify-version-test-"));
  const repository = new FileStrategyRepository(path.join(directory, "strategies.json"));
  const strategy = sampleStrategy();
  const created = await repository.create(
    {
      clientSaveId: "client-save-456",
      brief: "Build a strategy for my restaurant.",
      answers: [],
      strategy,
      versions: [
        {
          versionNumber: 1,
          data: strategy,
          changeRequest: "Initial strategy",
          createdAt: new Date().toISOString(),
        },
      ],
    },
    "owner-a",
  );

  const updated = await repository.appendVersion(
    created.id,
    "owner-a",
    sampleStrategy("Budget-optimized restaurant growth"),
    "budget_optimize",
  );

  assert.equal(updated.versions.length, 2);
  assert.equal(updated.versions[0].data.title, "Restaurant growth");
  assert.equal(updated.strategy.title, "Budget-optimized restaurant growth");
});
