import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { aiConfig } from "../src/services/ai/config.js";
import { getPricingForModel, calculateEstimatedCost } from "../src/services/telemetry/pricing.js";
import {
  PlannerTaskSummaryItemSchema,
  PlannerTaskSummaryOutputSchema,
} from "../src/domain/strategy.js";
import {
  summarizeTasksWithLuna,
  fallbackSummarizeTasks,
} from "../src/services/ai/strategy-service.js";
import { FilePlannerRepository } from "../src/repositories/file-planner-repository.js";
import {
  createPlannerRouter,
  TaskInputSchema,
  BatchCreateTasksSchema,
  UpdateTaskSchema,
  SummarizeTasksSchema,
} from "../src/http/planner-router.js";

test("1. aiConfig defines plannerSummaryModel as gpt-6-luna", () => {
  assert.equal(aiConfig.plannerSummaryModel, "gpt-6-luna");
});

test("2. pricing and telemetry support gpt-6-luna pricing calculations", () => {
  const pricing = getPricingForModel("gpt-6-luna");
  assert.equal(pricing.inputPerMillion, 0.25);
  assert.equal(pricing.outputPerMillion, 1.00);

  const cost = calculateEstimatedCost("gpt-6-luna", 1000, 500);
  assert.ok(cost.costUsd > 0);
  assert.ok(cost.costAzn > 0);
  assert.equal(cost.totalTokens, 1500);
});

test("3. Schema validation: Task and Summary schemas enforce strict validation (Rule 2)", () => {
  // PlannerTaskSummaryItemSchema
  const validItem = PlannerTaskSummaryItemSchema.parse({
    title: "Launch campaign audit",
    timeframe: "Today",
    status: "todo",
  });
  assert.equal(validItem.title, "Launch campaign audit");
  assert.equal(validItem.timeframe, "Today");
  assert.equal(validItem.status, "todo");

  // Rejects unknown fields
  assert.throws(() => {
    PlannerTaskSummaryItemSchema.parse({
      title: "Test",
      timeframe: "Today",
      status: "todo",
      unknownKey: "malicious",
    });
  });

  // TaskInputSchema
  const validTask = TaskInputSchema.parse({
    title: "1. Brand audit",
    timeframe: "Bu gün",
    status: "todo",
  });
  assert.equal(validTask.title, "1. Brand audit");

  assert.throws(() => {
    TaskInputSchema.parse({
      title: "Test",
      forbiddenField: true,
    });
  });

  // BatchCreateTasksSchema
  assert.throws(() => {
    BatchCreateTasksSchema.parse({ tasks: [] });
  });

  // SummarizeTasksSchema
  assert.throws(() => {
    SummarizeTasksSchema.parse({
      strategyId: "not-a-uuid",
    });
  });
});

test("4. fallbackSummarizeTasks properly cleans and normalizes tasks into title, timeframe, and status: todo", () => {
  const rawTasks = [
    "- 1. Review audience demographics and segments",
    "• Finalize marketing budget allocation",
    "Schedule kickoff meeting with stakeholders",
  ];

  const result = fallbackSummarizeTasks(rawTasks, "az", "gpt-6-luna");
  assert.equal(result.model, "gpt-6-luna");
  assert.equal(result.tasks.length, 3);

  assert.equal(result.tasks[0].title, "Review audience demographics and segments");
  assert.equal(result.tasks[0].status, "todo");
  assert.ok(result.tasks[0].timeframe);

  assert.equal(result.tasks[1].title, "Finalize marketing budget allocation");
  assert.equal(result.tasks[1].status, "todo");

  assert.equal(result.tasks[2].title, "Schedule kickoff meeting with stakeholders");
  assert.equal(result.tasks[2].status, "todo");
});

test("5. summarizeTasksWithLuna executes with gpt-6-luna and validates output structure", async () => {
  let capturedModel = null;
  let capturedMessages = null;

  const mockTasks = [
    { text: "1. Set up tracking pixels and analytics", timeframe: "Bu gün" },
    { text: "2. Conduct competitor pricing benchmark", timeframe: "Növbəti 48 saat" },
  ];

  const mockOpenAIClient = {
    chat: {
      completions: {
        async create(payload) {
          capturedModel = payload.model;
          capturedMessages = payload.messages;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    tasks: [
                      {
                        title: "Tracking pikselləri və analitikanı quraşdır",
                        timeframe: "Bu gün",
                        status: "todo",
                      },
                      {
                        title: "Rəqiblərin qiymət benchmark analizini apar",
                        timeframe: "Növbəti 48 saat",
                        status: "todo",
                      },
                    ],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 120, completion_tokens: 60, total_tokens: 180 },
          };
        },
      },
    },
  };

  let usageReported = null;
  const result = await summarizeTasksWithLuna({
    tasks: mockTasks,
    strategyTitle: "Baku Retail Strategy",
    language: "az",
    client: mockOpenAIClient,
    onUsage: (u) => { usageReported = u; },
  });

  assert.equal(capturedModel, "gpt-6-luna", "Model must be gpt-6-luna");
  assert.equal(result.model, "gpt-6-luna");
  assert.equal(result.tasks.length, 2);
  assert.equal(result.tasks[0].title, "Tracking pikselləri və analitikanı quraşdır");
  assert.equal(result.tasks[0].timeframe, "Bu gün");
  assert.equal(result.tasks[0].status, "todo");
  assert.ok(usageReported);
  assert.equal(usageReported.usage.totalTokens, 180);
});

test("6. FilePlannerRepository stores title, timeframe, status: todo and prevents duplicates", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-planner-test-"));
  const repoPath = path.join(tmpDir, "planner.json");
  const repo = new FilePlannerRepository(repoPath);

  const ownerId = "test-owner-uuid-123";
  const stratId = "11111111-2222-3333-4444-555555555555";

  // 1. Add single task with title, timeframe, status
  const added = await repo.addBatch(ownerId, [
    {
      title: "  - 1. Kampaniya büdcəsini təsdiqlə  ",
      timeframe: "Bu gün",
      status: "todo",
      strategyId: stratId,
      strategyTitle: "Qəhvə Strategiyası",
    },
  ]);

  assert.equal(added.length, 1);
  assert.equal(added[0].title, "Kampaniya büdcəsini təsdiqlə");
  assert.equal(added[0].text, "Kampaniya büdcəsini təsdiqlə");
  assert.equal(added[0].timeframe, "Bu gün");
  assert.equal(added[0].status, "todo");
  assert.equal(added[0].completed, false);

  // 2. Duplicate prevention
  const duplicateAttempt = await repo.addBatch(ownerId, [
    {
      title: "Kampaniya büdcəsini təsdiqlə",
      strategyId: stratId,
    },
  ]);
  assert.equal(duplicateAttempt.length, 0);

  // 3. Update task status to completed
  const updated = await repo.update(added[0].id, ownerId, { status: "completed" });
  assert.equal(updated.status, "completed");
  assert.equal(updated.completed, true);
  assert.ok(updated.completedAt);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("7. POST /api/planner route validates strictly and adds individual task with title, timeframe, status: todo", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-planner-route-test-"));
  const repoPath = path.join(tmpDir, "planner.json");
  const repo = new FilePlannerRepository(repoPath);
  const router = createPlannerRouter(repo);

  const req = {
    ownerId: "owner-abc",
    body: {
      title: "  • Rəqib analizini bitir  ",
      timeframe: "Bu həftə",
      status: "todo",
    },
  };

  let responseStatus = 200;
  let responseBody = null;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseBody = data;
      return this;
    },
  };

  const postHandler = router.stack.find((layer) => layer.route && layer.route.path === "/" && layer.route.methods.post)?.route?.stack[0]?.handle;
  assert.ok(postHandler);

  await postHandler(req, res);
  assert.equal(responseStatus, 201);
  assert.ok(responseBody.task);
  assert.equal(responseBody.task.title, "Rəqib analizini bitir");
  assert.equal(responseBody.task.timeframe, "Bu həftə");
  assert.equal(responseBody.task.status, "todo");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("8. POST /api/planner/summarize enforces tenant isolation (Rule 3) and returns gpt-6-luna tasks", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-planner-sum-test-"));
  const repoPath = path.join(tmpDir, "planner.json");
  const repo = new FilePlannerRepository(repoPath);

  const validStrategyId = "00000000-0000-0000-0000-000000000001";
  const mockStrategyRepo = {
    async getById(id, ownerId) {
      if (id === validStrategyId && ownerId === "legit-owner") {
        return {
          id,
          ownerId,
          strategy: {
            title: "Premium Baku Hotel Strategy",
            nextSteps: [
              "Launch Instagram ad campaign",
              "Partner with local food bloggers",
            ],
          },
        };
      }
      return null;
    },
  };

  const mockOpenAIClient = {
    chat: {
      completions: {
        async create(payload) {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    tasks: [
                      { title: "İnstagram reklam kampaniyasına start ver", timeframe: "Bu gün", status: "todo" },
                      { title: "Yemək bloqqerləri ilə tərəfdaşlıq qur", timeframe: "Növbəti 48 saat", status: "todo" },
                    ],
                  }),
                },
              },
            ],
          };
        },
      },
    },
  };

  const router = createPlannerRouter(repo, {
    strategyRepository: mockStrategyRepo,
    openAiClient: mockOpenAIClient,
  });

  const summarizeHandler = router.stack.find((layer) => layer.route && layer.route.path === "/summarize" && layer.route.methods.post)?.route?.stack[0]?.handle;
  assert.ok(summarizeHandler);

  // 1. Attacker attempting IDOR with another tenant's strategyId
  let idorStatus = 200;
  let idorBody = null;
  await summarizeHandler(
    {
      ownerId: "attacker-id",
      body: { strategyId: validStrategyId },
    },
    {
      status(s) { idorStatus = s; return this; },
      json(b) { idorBody = b; return this; },
    }
  );
  assert.equal(idorStatus, 404, "Must enforce tenant isolation and return 404 on IDOR attempt");

  // 2. Legitimate owner request
  let legitStatus = 200;
  let legitBody = null;
  await summarizeHandler(
    {
      ownerId: "legit-owner",
      body: { strategyId: validStrategyId },
    },
    {
      status(s) { legitStatus = s; return this; },
      json(b) { legitBody = b; return this; },
    }
  );

  assert.equal(legitStatus, 200);
  assert.equal(legitBody.model, "gpt-6-luna");
  assert.equal(legitBody.tasks.length, 2);
  assert.equal(legitBody.tasks[0].title, "İnstagram reklam kampaniyasına start ver");
  assert.equal(legitBody.tasks[0].status, "todo");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("9. Frontend and CSS integrity: XSS protection, dark mode parity, model name hidden from UI, and dual manual/AI options", async () => {
  const scriptContent = await fs.readFile(path.resolve("public/script.js"), "utf8");
  const styleContent = await fs.readFile(path.resolve("public/style.css"), "utf8");
  const i18nContent = await fs.readFile(path.resolve("public/i18n.js"), "utf8");

  // 1. script.js defines openPlannerTaskSelectionModal and buildNextStepsSection
  assert.ok(scriptContent.includes("function openPlannerTaskSelectionModal"), "Must define openPlannerTaskSelectionModal");
  assert.ok(scriptContent.includes("function buildNextStepsSection"), "Must define buildNextStepsSection");

  // 2. Model name is strictly hidden from user-visible UI
  assert.ok(!scriptContent.includes("✦ gpt-6-luna"), "UI must not expose raw model name to users");
  assert.ok(!i18nContent.includes("gpt-6-luna"), "i18n must not expose raw model name in UI strings");

  // 3. Dual manual as-is and AI summary bulk addition options exist
  assert.ok(scriptContent.includes("add-all-manual-btn"), "Manual bulk add button must exist");
  assert.ok(scriptContent.includes("add-ai-summary-btn"), "AI bulk add button must exist");
  assert.ok(scriptContent.includes("planner-modal-tabs"), "Modal must support tabs between AI and raw tasks");

  // 4. Strict XSS protection: No raw innerHTML on dynamic task titles in selection modal
  assert.ok(!scriptContent.includes("itemRow.innerHTML ="), "Must not use raw innerHTML on task rows");
  assert.ok(scriptContent.includes("planner-modal-item-text"), "Uses secure element textSpan for task title");

  // 5. Toast messaging accurately reflects requirements
  assert.ok(scriptContent.includes("1 tapşırıq Planner-ə əlavə edildi ✓"), "Single task AZ toast match");
  assert.ok(scriptContent.includes("1 task added to Planner ✓"), "Single task EN toast match");
  assert.ok(scriptContent.includes("tapşırıq Planner-ə əlavə edildi ✓"), "Bulk tasks AZ toast match");
  assert.ok(scriptContent.includes("tasks added to Planner ✓"), "Bulk tasks EN toast match");

  // 6. Duplicate prevention and Added indicator
  assert.ok(scriptContent.includes("isTaskAlreadyInPlanner"), "Must check if task is already in planner");
  assert.ok(scriptContent.includes("is-added"), "Must support is-added indicator state");

  // 7. CSS styles exist for modal, buttons, tabs, and dark mode
  assert.ok(styleContent.includes(".planner-modal-overlay"), "planner-modal-overlay CSS defined");
  assert.ok(styleContent.includes(".planner-modal-card"), "planner-modal-card CSS defined");
  assert.ok(styleContent.includes(".planner-modal-tabs"), "planner-modal-tabs CSS defined");
  assert.ok(styleContent.includes(".add-all-manual-btn"), "add-all-manual-btn CSS defined");
  assert.ok(styleContent.includes(".planner-modal-confirm-btn"), "planner-modal-confirm-btn CSS defined");
  assert.ok(styleContent.includes('[data-theme="dark"] .planner-modal-confirm-btn'), "Dark mode parity for modal button");
  assert.ok(styleContent.includes('[data-theme="dark"] .checklist-item .item-plan-btn.is-added'), "Dark mode parity for is-added button");

  // 8. i18n dictionary contains required planner keys without model name
  assert.ok(i18nContent.includes('modalBadge: "✦ AI Xülasəsi"'));
  assert.ok(i18nContent.includes('addAllManualBtn: "Olduğu kimi əlavə et"'));
  assert.ok(i18nContent.includes('tabAiSummary: "✦ AI Xülasəsi"'));
  assert.ok(i18nContent.includes('toastSingleAdded: "1 tapşırıq Planner-ə əlavə edildi ✓"'));
});
