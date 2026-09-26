import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { FilePlannerRepository } from "../src/repositories/file-planner-repository.js";
import { fallbackPrioritizeTasks, prioritizeTasksWithLuna } from "../src/services/ai/strategy-service.js";
import { PrioritizeTasksSchema } from "../src/http/planner-router.js";
import { UserSettingsSchema } from "../src/auth/validation.js";

test("planner repository persists tasks, handles completion, deletion, and owner claiming", async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-planner-test-"));
  const filePath = path.join(temporaryDirectory, "planner.json");
  const repository = new FilePlannerRepository(filePath);

  const guestOwnerId = "guest-123";
  const userOwnerId = "user-456";

  // 1. Batch add tasks from strategy
  const added = await repository.addBatch(guestOwnerId, [
    { text: "Brend workshop keçir", groupLabel: "Bu gün", strategyId: "strat-1", strategyTitle: "Burger Strategiyası" },
    { text: "Benchmark siyahısı yarat", groupLabel: "Növbəti 48 saat", strategyId: "strat-1", strategyTitle: "Burger Strategiyası" },
    { text: "Maliyyə modeli hazırla", groupLabel: "Bu həftə", strategyId: "strat-1", strategyTitle: "Burger Strategiyası" },
  ]);

  assert.equal(added.length, 3);
  let tasks = await repository.list(guestOwnerId);
  assert.equal(tasks.length, 3);

  // 2. Duplicate prevention for same strategy
  const dupAdded = await repository.addBatch(guestOwnerId, [
    { text: "Brend workshop keçir", groupLabel: "Bu gün", strategyId: "strat-1", strategyTitle: "Burger Strategiyası" },
  ]);
  assert.equal(dupAdded.length, 0);
  tasks = await repository.list(guestOwnerId);
  assert.equal(tasks.length, 3);

  // 3. Mark task completed
  const targetTask = tasks[0];
  const updated = await repository.update(targetTask.id, guestOwnerId, { completed: true });
  assert.equal(updated.completed, true);
  assert.ok(updated.completedAt);

  // 4. Claim tasks when guest signs up
  const claimedCount = await repository.claimOwner(guestOwnerId, userOwnerId);
  assert.equal(claimedCount, 3);

  const oldGuestTasks = await repository.list(guestOwnerId);
  assert.equal(oldGuestTasks.length, 0);

  let userTasks = await repository.list(userOwnerId);
  assert.equal(userTasks.length, 3);

  // 5. Clear completed tasks
  const clearedCount = await repository.clearCompleted(userOwnerId);
  assert.equal(clearedCount, 1);

  userTasks = await repository.list(userOwnerId);
  assert.equal(userTasks.length, 2);

  // 6. Mass assignment protection: attempts to modify id, ownerId, or createdAt are blocked
  const originalTask = userTasks[0];
  const originalId = originalTask.id;
  const originalCreatedAt = originalTask.createdAt;
  const attemptedTamper = await repository.update(originalId, userOwnerId, {
    id: "tampered-id-123",
    ownerId: "attacker-user-id",
    createdAt: "2020-01-01T00:00:00.000Z",
    text: "Təhlükəsiz yenilənmiş mətn",
  });
  assert.equal(attemptedTamper.id, originalId);
  assert.equal(attemptedTamper.ownerId, userOwnerId);
  assert.equal(attemptedTamper.createdAt, originalCreatedAt);
  assert.equal(attemptedTamper.text, "Təhlükəsiz yenilənmiş mətn");

  // 7. Delete a task
  const deleteOk = await repository.delete(userTasks[0].id, userOwnerId);
  assert.equal(deleteOk, true);

  userTasks = await repository.list(userOwnerId);
  assert.equal(userTasks.length, 1);

  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test("planner frontend: Execute button, category Select All, Roadmap generation, and dark mode parity", async () => {
  const scriptContent = await fs.readFile(path.join(process.cwd(), "public/script.js"), "utf8");
  const styleContent = await fs.readFile(path.join(process.cwd(), "public/style.css"), "utf8");
  const i18nContent = await fs.readFile(path.join(process.cwd(), "public/i18n.js"), "utf8");

  // 1. i18n verification
  assert.ok(i18nContent.includes('executeTask: "İcra et"'), "AZ i18n has executeTask");
  assert.ok(i18nContent.includes('generateRoadmap: "İcra xəritəsi hazırla"'), "AZ i18n has generateRoadmap");
  assert.ok(i18nContent.includes('executeTask: "Execute"'), "EN i18n has executeTask");
  assert.ok(i18nContent.includes('generateRoadmap: "Prepare execution map"'), "EN i18n has generateRoadmap");

  // 2. script.js executePlannerTask and Ask mode context
  assert.ok(scriptContent.includes("function executePlannerTask(task)"), "script.js defines executePlannerTask");
  assert.ok(scriptContent.includes('setMode("ask")'), "executePlannerTask sets mode to ask");
  assert.ok(scriptContent.includes("state.askStrategyId = task.strategyId"), "executePlannerTask sets askStrategyId");
  assert.ok(scriptContent.includes("state.askTaskId = task.id"), "executePlannerTask sets askTaskId");
  assert.ok(scriptContent.includes("planner-execute-btn"), "planner-execute-btn is created");

  // 3. script.js Select All and Roadmap generation
  assert.ok(scriptContent.includes("function generateExecutionRoadmapForTasks("), "generateExecutionRoadmapForTasks defined");
  assert.ok(scriptContent.includes("planner-select-all-btn"), "planner-select-all-btn is created");
  assert.ok(scriptContent.includes("planner-roadmap-btn"), "planner-roadmap-btn is created");
  assert.ok(scriptContent.includes("planner-floating-actions"), "planner-floating-actions dock is created");
  assert.ok(scriptContent.includes("plannerSelectedTaskIds"), "plannerSelectedTaskIds is tracked in state");

  // 4. style.css styling and dark theme parity
  assert.ok(styleContent.includes(".planner-execute-btn"), "style.css defines .planner-execute-btn");
  assert.ok(styleContent.includes(".planner-select-all-btn"), "style.css defines .planner-select-all-btn");
  assert.ok(styleContent.includes(".planner-roadmap-btn"), "style.css defines .planner-roadmap-btn");
  assert.ok(styleContent.includes(".planner-task-card.is-selected"), "style.css defines selected card styling");
  assert.ok(styleContent.includes(".planner-floating-actions"), "style.css defines floating action dock");
  assert.ok(styleContent.includes(".planner-task-card.is-selected .planner-execute-btn"), "style.css hides execute button on selected cards");
  assert.ok(styleContent.includes(".planner-group.has-bulk-selection .planner-execute-btn"), "style.css hides execute button on bulk selection");
  assert.ok(scriptContent.includes('groupEl.classList.toggle("has-bulk-selection", allSelected)'), "script.js toggles has-bulk-selection on group");

  // 5. Priority filter pill with "New" badge and gpt-6-luna model attribution
  assert.ok(scriptContent.includes('key: "priority"'), "script.js includes priority filter pill");
  assert.ok(scriptContent.includes("isNew: true"), "priority option has isNew flag");
  assert.ok(scriptContent.includes("planner-pill-new-badge"), "script.js creates planner-pill-new-badge");
  assert.ok(scriptContent.includes('"New"'), "script.js renders New badge text");
  assert.ok(scriptContent.includes("prioritizePlannerTasksWithLuna"), "script.js defines prioritizePlannerTasksWithLuna");
  assert.ok(!scriptContent.includes("gpt-6-luna"), "script.js does not display raw gpt-6-luna model name in UI");
  assert.ok(!scriptContent.includes("planner-ai-model-tag"), "script.js does not render AI chip in priority");
  assert.ok(scriptContent.includes('searchBar.classList.toggle("is-hidden-by-selection", hasSelection)'), "script.js hides search bar on selection");
  assert.ok(styleContent.includes(".planner-search-bar.is-hidden-by-selection"), "style.css hides search bar on selection");
  assert.ok(scriptContent.includes("planner-card-priority-badge"), "script.js renders priority badge on cards");
  assert.ok(scriptContent.includes('plannerFilter === "priority"'), "script.js filters only priority tasks");

  // 6. style.css Priority styling and dark theme parity
  assert.ok(styleContent.includes(".planner-pill-new-badge"), "style.css defines .planner-pill-new-badge");
  assert.ok(styleContent.includes(".planner-priority-ai-banner"), "style.css defines .planner-priority-ai-banner");
  assert.ok(styleContent.includes(".planner-card-priority-badge"), "style.css defines .planner-card-priority-badge");
  assert.ok(styleContent.includes(".planner-task-card.is-priority"), "style.css defines .planner-task-card.is-priority");
  assert.ok(styleContent.includes(".planner-priority-action-btn"), "style.css defines .planner-priority-action-btn");
  assert.ok(styleContent.includes(".planner-reprioritize-btn"), "style.css defines .planner-reprioritize-btn");

  // 7. i18n Priority keys
  assert.ok(i18nContent.includes('filterPriority: "Prioritet"'), "AZ i18n has filterPriority");
  assert.ok(i18nContent.includes('filterPriority: "Priority"'), "EN i18n has filterPriority");
  assert.ok(i18nContent.includes('priorityNewBadge: "New"'), "i18n defines priorityNewBadge");
});

test("planner repository: supports priority tracking, batch update, and isolation", async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-planner-priority-test-"));
  const filePath = path.join(temporaryDirectory, "planner.json");
  const repository = new FilePlannerRepository(filePath);

  const owner1 = "owner-111";
  const owner2 = "owner-222";

  const added1 = await repository.addBatch(owner1, [
    { text: "Launch campaign", groupLabel: "Bu gün", isPriority: true },
    { text: "Update website copy", groupLabel: "Növbəti 48 saat", isPriority: false },
  ]);
  const added2 = await repository.addBatch(owner2, [
    { text: "Audit competitor prices", groupLabel: "Bu gün", isPriority: false },
  ]);

  assert.equal(added1[0].isPriority, true);
  assert.equal(added1[0].priority, "high");
  assert.equal(added1[1].isPriority, false);
  assert.equal(added1[1].priority, "normal");

  // update single task priority
  const updated = await repository.update(added1[1].id, owner1, { isPriority: true, priority: "high" });
  assert.equal(updated.isPriority, true);
  assert.equal(updated.priority, "high");

  // batch updatePriorities
  const priorityIds = new Set([added1[0].id]);
  const res = await repository.updatePriorities(owner1, priorityIds);
  const task0 = res.find((t) => t.id === added1[0].id);
  const task1 = res.find((t) => t.id === added1[1].id);
  assert.equal(task0.isPriority, true);
  assert.equal(task1.isPriority, false);

  // Tenant isolation: owner2's tasks are unaffected
  const owner2Tasks = await repository.list(owner2);
  assert.equal(owner2Tasks.length, 1);
  assert.equal(owner2Tasks[0].isPriority, false);

  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test("planner AI prioritization: fallbackPrioritizeTasks and prioritizeTasksWithLuna utilize gpt-6-luna", async () => {
  const sampleTasks = [
    { id: "task-1", title: "Launch marketing campaign", timeframe: "Bu gün" },
    { id: "task-2", title: "Routine coffee cup order", timeframe: "Gələcəkdə" },
    { id: "task-3", title: "Urgent contract review", timeframe: "Növbəti 48 saat" },
  ];

  const fallbackResult = fallbackPrioritizeTasks(sampleTasks, "az", "gpt-6-luna");
  assert.equal(fallbackResult.model, "gpt-6-luna");
  assert.ok(fallbackResult.prioritizedTaskIds.includes("task-1"));
  assert.ok(fallbackResult.prioritizedTaskIds.includes("task-3"));
  assert.equal(fallbackResult.prioritizedTaskIds.includes("task-2"), false);

  // Test prioritizeTasksWithLuna without external client (uses fallback)
  const lunaResult = await prioritizeTasksWithLuna({ tasks: sampleTasks, language: "az" });
  assert.equal(lunaResult.model, "gpt-6-luna");
  assert.ok(Array.isArray(lunaResult.prioritizedTaskIds));
  assert.ok(lunaResult.prioritizedTaskIds.length > 0);
});

test("planner router: PrioritizeTasksSchema validates strictly (Rule 2 & Rule 3)", async () => {
  // 1. Zod strict validation
  const valid = PrioritizeTasksSchema.safeParse({ language: "az" });
  assert.equal(valid.success, true);

  const invalidTamper = PrioritizeTasksSchema.safeParse({ language: "az", unexpectedField: "hack" });
  assert.equal(invalidTamper.success, false);

  const invalidId = PrioritizeTasksSchema.safeParse({ taskIds: ["not-a-uuid"] });
  assert.equal(invalidId.success, false);
});

test("planner notifications: notification bell, site visit greeting, and user preferences", async () => {
  const scriptContent = await fs.readFile(path.resolve("public/script.js"), "utf8");
  const styleContent = await fs.readFile(path.resolve("public/style.css"), "utf8");
  const i18nContent = await fs.readFile(path.resolve("public/i18n.js"), "utf8");

  // 1. Planner header notification button and popover
  assert.ok(scriptContent.includes("planner-notif-btn"), "script.js defines planner-notif-btn");
  assert.ok(scriptContent.includes("planner-notif-bell-icon"), "script.js renders bell icon");
  assert.ok(scriptContent.includes("togglePlannerNotificationPopover"), "script.js defines togglePlannerNotificationPopover");
  assert.ok(scriptContent.includes("planner-notif-popover"), "script.js creates planner-notif-popover");
  assert.ok(styleContent.includes(".planner-notif-btn"), "style.css styles .planner-notif-btn");
  assert.ok(styleContent.includes(".planner-notif-popover"), "style.css styles .planner-notif-popover");

  // 2. Exact greeting message format
  assert.ok(scriptContent.includes("Planlaşdırılanlarda hələ də icra gözləyən prioritet tapşırıq(ların) mövcuddur. Nəzərdən keçirməyi unutma."), "script.js contains exact required greeting in AZ");
  assert.ok(scriptContent.includes("You still have pending priority task(s) in Planner waiting for execution. Don't forget to review them."), "script.js contains exact greeting in EN");

  // 3. Remind me later and Deactivate options
  assert.ok(scriptContent.includes("snoozePlannerNotification"), "script.js implements snoozePlannerNotification");
  assert.ok(scriptContent.includes("setPlannerNotificationsEnabled"), "script.js implements setPlannerNotificationsEnabled");
  assert.ok(scriptContent.includes("planner-visit-toast"), "script.js renders planner-visit-toast");
  assert.ok(styleContent.includes(".planner-visit-toast"), "style.css styles .planner-visit-toast");

  // 4. UserSettingsSchema supports plannerNotifications (Rule 2)
  const defaultSettings = UserSettingsSchema.parse({});
  assert.equal(defaultSettings.plannerNotifications, true);

  const disabledSettings = UserSettingsSchema.parse({ plannerNotifications: false });
  assert.equal(disabledSettings.plannerNotifications, false);

  const enabledSettings = UserSettingsSchema.parse({ plannerNotifications: true });
  assert.equal(enabledSettings.plannerNotifications, true);

  // 5. i18n keys exist
  assert.ok(i18nContent.includes('notifRemindLater: "Daha sonra xatırlat"'), "AZ i18n contains notifRemindLater");
  assert.ok(i18nContent.includes('notifRemindLater: "Remind me later"'), "EN i18n contains notifRemindLater");
  assert.ok(i18nContent.includes('notifWindowSubtitle: "İcra gözləyən prioritet tapşırıqlar"'), "AZ i18n contains notifWindowSubtitle");
  assert.ok(i18nContent.includes('notifWindowSubtitle: "Pending priority tasks"'), "EN i18n contains notifWindowSubtitle");
  assert.ok(i18nContent.includes('plannerNotifTitle: "Planlaşdırılanlar Xatırlatmaları"'), "AZ settings i18n contains plannerNotifTitle");
  assert.ok(i18nContent.includes('plannerNotifTitle: "Planner Priority Reminders"'), "EN settings i18n contains plannerNotifTitle");

  // 6. Mobile bottom sheet support
  assert.ok(scriptContent.includes("openPlannerNotificationSheet"), "script.js implements openPlannerNotificationSheet");
  assert.ok(scriptContent.includes("closePlannerNotificationSheet"), "script.js implements closePlannerNotificationSheet");
  assert.ok(scriptContent.includes("mobileNotifSheetOverlay"), "script.js references mobileNotifSheetOverlay");
  assert.ok(styleContent.includes(".mobile-notif-sheet"), "style.css styles .mobile-notif-sheet");
  assert.ok(styleContent.includes(".mobile-notif-sheet-overlay"), "style.css styles .mobile-notif-sheet-overlay");
});
