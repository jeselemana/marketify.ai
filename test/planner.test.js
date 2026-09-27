import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { FilePlannerRepository } from "../src/repositories/file-planner-repository.js";
import { fallbackPrioritizeTasks, prioritizeTasksWithLuna } from "../src/services/ai/strategy-service.js";
import { PrioritizeTasksSchema, TaskInputSchema, UpdateTaskSchema } from "../src/http/planner-router.js";
import { UserSettingsSchema } from "../src/auth/validation.js";
import { FileTelemetryRepository } from "../src/repositories/file-telemetry-repository.js";
import { TelemetryService } from "../src/services/telemetry/telemetry-service.js";

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
  assert.ok(styleContent.includes(".planner-task-card.is-done .planner-execute-btn"), "style.css hides execute button on completed cards");
  assert.ok(styleContent.includes(".planner-group.has-bulk-selection .planner-execute-btn"), "style.css hides execute button on bulk selection");
  assert.ok(scriptContent.includes("executeBtn.hidden = task.completed"), "script.js hides execute button on completed tasks");
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

test("planner task feedback: persists feedback, distinguishes brief vs user tasks, validates schema, and renders bottom-left UI with dark mode parity", async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-planner-feedback-test-"));
  const filePath = path.join(temporaryDirectory, "planner.json");
  const repository = new FilePlannerRepository(filePath);

  const ownerId = "owner-feedback-test";

  // 1. Brief-added task has source: "brief"
  const briefTasks = await repository.addBatch(ownerId, [
    { text: "Rəqib analizi apar", groupLabel: "Bu gün", strategyId: "550e8400-e29b-41d4-a716-446655440000", strategyTitle: "Bazar Strategiyası" },
  ]);
  assert.equal(briefTasks.length, 1);
  assert.equal(briefTasks[0].source, "brief");
  assert.equal(briefTasks[0].feedback, null);

  // 2. User-manually added task (no strategy association) has source: "user"
  const userTasks = await repository.addBatch(ownerId, [
    { text: "Şəxsi qeyd yaz", groupLabel: "Ümumi" },
  ]);
  assert.equal(userTasks.length, 1);
  assert.equal(userTasks[0].source, "user");
  assert.equal(userTasks[0].feedback, null);

  // 3. Update brief task with feedback: "like"
  const liked = await repository.update(briefTasks[0].id, ownerId, { completed: true, feedback: "like" });
  assert.equal(liked.completed, true);
  assert.equal(liked.feedback, "like");

  // 4. Update brief task with feedback: "dislike"
  const disliked = await repository.update(briefTasks[0].id, ownerId, { feedback: "dislike" });
  assert.equal(disliked.feedback, "dislike");

  // 5. Clear feedback
  const clearedFeedback = await repository.update(briefTasks[0].id, ownerId, { feedback: null });
  assert.equal(clearedFeedback.feedback, null);

  // 6. Schema validation strictly allows like/dislike/null and rejects unknown fields or invalid feedback
  const validLike = UpdateTaskSchema.safeParse({ feedback: "like" });
  assert.equal(validLike.success, true);

  const validDislike = UpdateTaskSchema.safeParse({ feedback: "dislike" });
  assert.equal(validDislike.success, true);

  const validNull = UpdateTaskSchema.safeParse({ feedback: null });
  assert.equal(validNull.success, true);

  const invalidFeedback = UpdateTaskSchema.safeParse({ feedback: "neutral" });
  assert.equal(invalidFeedback.success, false);

  const invalidUnknown = UpdateTaskSchema.safeParse({ feedback: "like", maliciousField: true });
  assert.equal(invalidUnknown.success, false);

  const validTaskInput = TaskInputSchema.safeParse({ text: "Test", source: "brief", feedback: "like" });
  assert.equal(validTaskInput.success, true);

  // 7. Frontend script.js verification
  const scriptContent = await fs.readFile(path.resolve("public/script.js"), "utf8");
  assert.ok(scriptContent.includes("planner-task-feedback"), "script.js creates planner-task-feedback");
  assert.ok(scriptContent.includes("isBriefTask"), "script.js determines isBriefTask");
  assert.ok(scriptContent.includes("planner-feedback-prompt"), "script.js creates planner-feedback-prompt");
  assert.ok(scriptContent.includes("planner-feedback-btn"), "script.js creates planner-feedback-btn");
  assert.ok(scriptContent.includes("is-like"), "script.js handles like feedback button");
  assert.ok(scriptContent.includes("is-dislike"), "script.js handles dislike feedback button");
  assert.ok(scriptContent.includes("planner.taskHelpfulQuestion"), "script.js uses taskHelpfulQuestion translation");
  assert.ok(scriptContent.includes('closest(".planner-task-feedback")'), "script.js isolates card click from feedback clicks");

  // 8. Frontend i18n.js verification
  const i18nContent = await fs.readFile(path.resolve("public/i18n.js"), "utf8");
  assert.ok(i18nContent.includes('taskHelpfulQuestion: "Bu tapşırıq faydalı oldu?"'), "AZ i18n has exact prompt question");
  assert.ok(i18nContent.includes('taskHelpfulQuestion: "Was this task helpful?"'), "EN i18n has exact prompt question");
  assert.ok(i18nContent.includes('taskHelpfulYes: "Faydalı oldu"'), "AZ i18n has taskHelpfulYes");
  assert.ok(i18nContent.includes('taskHelpfulNo: "Faydalı olmadı"'), "AZ i18n has taskHelpfulNo");
  assert.ok(i18nContent.includes('taskFeedbackRecorded: "Rəyiniz qeydə alındı ✓"'), "AZ i18n has taskFeedbackRecorded");

  // 9. Frontend style.css verification with dark mode parity
  const styleContent = await fs.readFile(path.resolve("public/style.css"), "utf8");
  assert.ok(styleContent.includes(".planner-task-feedback"), "style.css styles .planner-task-feedback");
  assert.ok(styleContent.includes("align-self: flex-start;"), "style.css aligns feedback to bottom-left corner");
  assert.ok(styleContent.includes(".planner-feedback-prompt"), "style.css styles prompt text");
  assert.ok(styleContent.includes(".planner-feedback-btn"), "style.css styles feedback buttons");
  assert.ok(styleContent.includes(".planner-feedback-btn.is-like.is-active"), "style.css styles active like button");
  assert.ok(styleContent.includes(".planner-feedback-btn.is-dislike.is-active"), "style.css styles active dislike button");
  assert.ok(styleContent.includes('[data-theme="dark"] .planner-task-feedback'), "style.css has dark mode styles for planner feedback");
  assert.ok(styleContent.includes('[data-theme="dark"] .planner-feedback-btn.is-like.is-active'), "style.css has dark mode active like button");
  assert.ok(styleContent.includes('[data-theme="dark"] .planner-feedback-btn.is-dislike.is-active'), "style.css has dark mode active dislike button");

  // 10. Mobile responsiveness verification for planner task feedback:
  const mobilePlannerSection = styleContent.slice(styleContent.indexOf("@media (max-width: 640px)"));
  assert.ok(mobilePlannerSection.includes(".planner-task-feedback"), "style.css adapts feedback for mobile (<=640px)");
  assert.ok(mobilePlannerSection.includes(".planner-feedback-btn"), "style.css adapts feedback button touch targets for mobile");

  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test("planner completed tasks: cannot be selected, Select All is hidden/disabled, and feedback is routed to admin panel with clear explanation", async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-planner-admin-feedback-"));
  const telemetryPath = path.join(temporaryDirectory, "telemetry.json");
  const telemetryRepo = new FileTelemetryRepository(telemetryPath);
  const telemetryService = new TelemetryService(telemetryRepo);

  // 1. Verify trackTaskFeedback logs event with clear explanation for Like
  const likeEvent = await telemetryService.trackTaskFeedback({
    ownerId: "owner-123",
    taskId: "task-abc",
    taskText: "Pilot layihənin qiymətlərini təsdiq et",
    feedback: "like",
    strategyTitle: "Restoran İnkişaf Planı",
    source: "brief",
  });

  assert.ok(likeEvent);
  assert.equal(likeEvent.eventType, "task_feedback");
  assert.equal(likeEvent.mode, "planner");
  assert.equal(likeEvent.category, "İcra Rəyi");
  assert.equal(likeEvent.status, "success");
  assert.ok(likeEvent.metadata.explanation.includes("FAYDALI hesab etdi"));
  assert.ok(likeEvent.metadata.izahat.includes("Restoran İnkişaf Planı"));

  // 2. Verify trackTaskFeedback logs event with clear explanation for Dislike
  const dislikeEvent = await telemetryService.trackTaskFeedback({
    ownerId: "owner-123",
    taskId: "task-xyz",
    taskText: "20 soyuq zəng et",
    feedback: "dislike",
    strategyTitle: "B2B Satış Strategiyası",
    source: "brief",
    userNote: "Zaman uyğunsuzluğu var idi",
  });

  assert.ok(dislikeEvent);
  assert.equal(dislikeEvent.eventType, "task_feedback");
  assert.equal(dislikeEvent.mode, "planner");
  assert.equal(dislikeEvent.status, "warning");
  assert.ok(dislikeEvent.metadata.explanation.includes("FAYDASIZ / QEYRİ-EFFEKTİV hesab etdi"));
  assert.ok(dislikeEvent.metadata.explanation.includes("Zaman uyğunsuzluğu var idi"));

  // 3. Telemetry listEvents can filter by mode: "planner" and search by keyword
  const plannerEvents = await telemetryRepo.listEvents({ mode: "planner" });
  assert.equal(plannerEvents.total, 2);

  const searchResults = await telemetryRepo.listEvents({ search: "FAYDASIZ" });
  assert.equal(searchResults.total, 1);
  assert.equal(searchResults.items[0].id, dislikeEvent.id);

  // 4. Frontend script.js verification:
  // - Completed tasks cannot be selected
  // - Select All button only operates on active tasks and hides when all tasks are completed
  const scriptContent = await fs.readFile(path.resolve("public/script.js"), "utf8");
  assert.ok(scriptContent.includes("if (task.completed) {"), "script.js blocks card click when task.completed is true");
  assert.ok(scriptContent.includes("!task.completed && state.plannerSelectedTaskIds.has(task.id)"), "script.js excludes completed tasks from selection rendering");
  assert.ok(scriptContent.includes("groupTasks.filter((t) => !t.completed)"), "script.js filters active tasks for selectAllBtn");
  assert.ok(scriptContent.includes('selectAllBtn.style.display = "none"'), "script.js hides selectAllBtn when group has no active tasks");

  // 5. Frontend admin.js verification:
  // - Admin panel displays icon, Like/Dislike badges, and modal chips
  const adminScriptContent = await fs.readFile(path.resolve("public/admin.js"), "utf8");
  assert.ok(adminScriptContent.includes('eventType === "task_feedback"'), "admin.js checks for task_feedback eventType");
  assert.ok(adminScriptContent.includes("feedback-indicator"), "admin.js renders feedback indicator badge");
  assert.ok(adminScriptContent.includes('"Aydın İzahat"'), "admin.js renders Aydın İzahat modal chip");
  assert.ok(adminScriptContent.includes('"Rəy"'), "admin.js renders Rəy modal chip");

  // 6. Admin HTML & CSS verification:
  const adminHtmlContent = await fs.readFile(path.resolve("public/index_admin.html"), "utf8");
  assert.ok(adminHtmlContent.includes('value="planner"'), "index_admin.html includes planner in telemetryModeFilter");

  const adminCssContent = await fs.readFile(path.resolve("public/admin.css"), "utf8");
  assert.ok(adminCssContent.includes(".mode-badge-planner"), "admin.css defines .mode-badge-planner");
  assert.ok(adminCssContent.includes(".feedback-indicator"), "admin.css defines .feedback-indicator");
  assert.ok(adminCssContent.includes(".feedback-like"), "admin.css defines .feedback-like");
  assert.ok(adminCssContent.includes(".feedback-dislike"), "admin.css defines .feedback-dislike");
  assert.ok(adminCssContent.includes(".telemetry-filter-bar"), "admin.css adapts telemetry filter bar for mobile");

  // 7. Planner CSS verification:
  const plannerCssContent = await fs.readFile(path.resolve("public/style.css"), "utf8");
  assert.ok(plannerCssContent.includes(".planner-task-card.is-done"), "style.css styles .planner-task-card.is-done");
  assert.ok(plannerCssContent.includes("cursor: default;"), "style.css sets cursor: default on completed cards");

  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});
