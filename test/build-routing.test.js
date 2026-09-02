import assert from "node:assert/strict";
import test from "node:test";
import { AssessRequestSchema, GenerateRequestSchema } from "../src/domain/strategy.js";
import { LLMProviderError } from "../src/services/ai/llm-router.js";

test("strategy requests no longer accept a selectable model", () => {
  const assessment = AssessRequestSchema.parse({ brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı" });
  assert.equal("model" in assessment, false);

  const generation = GenerateRequestSchema.parse({
    brief: "Bakıda yeni açılan premium qadın geyim butiki üçün 3 aylıq böyümə planı",
    idempotencyKey: "test-idempotency-key-12345",
  });
  assert.equal("model" in generation, false);
});

test("LLMProviderError retains provider metadata", () => {
  const error = new LLMProviderError("OpenAI xidməti əlçatan deyil.", {
    code: "AI_PROVIDER_UNAVAILABLE",
    status: 503,
    model: "gpt-5.6-terra",
    provider: "openai",
  });
  assert.equal(error.code, "AI_PROVIDER_UNAVAILABLE");
  assert.equal(error.status, 503);
  assert.equal(error.model, "gpt-5.6-terra");
  assert.equal(error.provider, "openai");
});

test("strategy router GET /:id returns single strategy, validates id, and enforces ownership", async (t) => {
  const os = (await import("node:os")).default;
  const path = (await import("node:path")).default;
  const fs = (await import("node:fs/promises")).default;
  const { FileStrategyRepository } = await import("../src/repositories/file-strategy-repository.js");
  const { createStrategyRouter, strategyErrorHandler } = await import("../src/http/strategy-router.js");

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-router-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const repository = new FileStrategyRepository(path.join(directory, "strategies.json"));
  const sampleData = {
    title: "Test Brand Strategy",
    summary: "A focused strategy summary.",
    context: {},
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  };

  const created = await repository.create(
    {
      clientSaveId: "save-1",
      brief: "Test brief",
      answers: [],
      strategy: sampleData,
      versions: [{ versionNumber: 1, data: sampleData, changeRequest: "Initial", createdAt: new Date().toISOString() }],
    },
    "owner-user-1",
  );

  const router = createStrategyRouter(repository);

  async function callRoute(method, url, ownerId) {
    return new Promise((resolve) => {
      let status = 200;
      const req = {
        method,
        url,
        baseUrl: "/api/strategy",
        params: {},
        ownerId,
        headers: {},
        on: () => {},
      };
      const res = {
        status(s) {
          status = s;
          return this;
        },
        json(data) {
          resolve({ status, body: data });
          return this;
        },
        setHeader() {},
      };
      router.handle(req, res, (err) => {
        if (err) {
          strategyErrorHandler(err, req, res, () => {
            resolve({ status: 500, body: { error: err.message } });
          });
        } else {
          resolve({ status: 404, body: { error: "Not matched" } });
        }
      });
    });
  }

  // 1. Valid ID & matching owner -> 200 with strategy
  const res1 = await callRoute("GET", `/${created.id}`, "owner-user-1");
  assert.equal(res1.status, 200);
  assert.equal(res1.body.strategy.id, created.id);
  assert.equal(res1.body.strategy.title, "Test Brand Strategy");
  assert.equal("ownerId" in res1.body.strategy, false);

  // 2. Non-existent UUID -> 404
  const res2 = await callRoute("GET", "/00000000-0000-0000-0000-000000000000", "owner-user-1");
  assert.equal(res2.status, 404);
  assert.equal(res2.body.code, "NOT_FOUND");

  // 3. Different owner -> 404
  const res3 = await callRoute("GET", `/${created.id}`, "owner-user-2");
  assert.equal(res3.status, 404);
  assert.equal(res3.body.code, "NOT_FOUND");

  // 4. Invalid UUID format -> 400
  const res4 = await callRoute("GET", "/invalid-id", "owner-user-1");
  assert.equal(res4.status, 400);
  assert.equal(res4.body.code, "VALIDATION_ERROR");
});

test("strategy router POST /generate returns existing saved strategy if clientSaveId exists", async (t) => {
  const os = (await import("node:os")).default;
  const path = (await import("node:path")).default;
  const fs = (await import("node:fs/promises")).default;
  const { FileStrategyRepository } = await import("../src/repositories/file-strategy-repository.js");
  const { createStrategyRouter, strategyErrorHandler } = await import("../src/http/strategy-router.js");

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-idempotent-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const repository = new FileStrategyRepository(path.join(directory, "strategies.json"));
  const sampleData = {
    title: "Pre-existing Strategy",
    summary: "A focused strategy summary.",
    context: {},
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  };

  await repository.create(
    {
      clientSaveId: "idempotency-key-xyz",
      brief: "Test brief for pre-existing",
      answers: [],
      strategy: sampleData,
      versions: [{ versionNumber: 1, data: sampleData, changeRequest: "Initial", createdAt: new Date().toISOString() }],
    },
    "owner-user-1",
  );

  const router = createStrategyRouter(repository);

  const req = {
    method: "POST",
    url: "/generate",
    baseUrl: "/api/strategy",
    body: {
      brief: "Test brief for pre-existing",
      idempotencyKey: "idempotency-key-xyz",
      answers: [],
    },
    ownerId: "owner-user-1",
    headers: {},
    on: () => {},
  };

  const response = await new Promise((resolve) => {
    let statusCode = 200;
    const res = {
      status(s) {
        statusCode = s;
        return this;
      },
      json(data) {
        resolve({ status: statusCode, body: data });
        return this;
      },
      setHeader() {},
    };

    router.handle(req, res, (err) => {
      if (err) {
        strategyErrorHandler(err, req, res, () => resolve({ status: 500, body: { error: err.message } }));
      } else {
        resolve({ status: 404, body: { error: "Not matched" } });
      }
    });
  });

  assert.equal(response.status, 200);
  assert.equal(response.body?.strategy?.title, "Pre-existing Strategy");
});


