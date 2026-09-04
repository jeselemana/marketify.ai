import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { FilePlannerRepository } from "../src/repositories/file-planner-repository.js";

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
