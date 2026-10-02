import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

import { FileStrategyRepository } from "../src/repositories/file-strategy-repository.js";
import { FileChatRepository } from "../src/repositories/file-chat-repository.js";
import { FilePlannerRepository } from "../src/repositories/file-planner-repository.js";

test("Tier 3 - Combination 1: Multi-tenant repository data separation and cascade isolation", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tier3-multitenant-"));
  const stratRepo = new FileStrategyRepository(path.join(tmpDir, "strats.json"));
  const chatRepo = new FileChatRepository(path.join(tmpDir, "chats.json"));
  const plannerRepo = new FilePlannerRepository(path.join(tmpDir, "planner.json"));

  const tenantA = `usr_${randomUUID()}`;
  const tenantB = `usr_${randomUUID()}`;
  const tenantC = `usr_${randomUUID()}`;

  const sampleStrategy = (title) => ({
    title,
    summary: `Summary of ${title}`,
    context: {},
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  });

  // 1. Create resources across tenants
  const stratA = await stratRepo.create({
    clientSaveId: "cs_a",
    brief: "Brief A",
    answers: [],
    strategy: sampleStrategy("Strategy A"),
    versions: [{ versionNumber: 1, data: sampleStrategy("Strategy A"), createdAt: new Date().toISOString() }],
  }, tenantA);

  const stratB = await stratRepo.create({
    clientSaveId: "cs_b",
    brief: "Brief B",
    answers: [],
    strategy: sampleStrategy("Strategy B"),
    versions: [{ versionNumber: 1, data: sampleStrategy("Strategy B"), createdAt: new Date().toISOString() }],
  }, tenantB);

  const chatA = await chatRepo.saveChat({
    ownerId: tenantA,
    title: "Chat A",
    messages: [{ role: "user", content: "Msg A" }],
  });

  const chatB = await chatRepo.saveChat({
    ownerId: tenantB,
    title: "Chat B",
    messages: [{ role: "user", content: "Msg B" }],
  });

  await plannerRepo.addBatch(tenantA, [{ text: "Task A", groupLabel: "Group A" }]);
  await plannerRepo.addBatch(tenantB, [{ text: "Task B", groupLabel: "Group B" }]);
  await plannerRepo.addBatch(tenantC, [{ text: "Task C", groupLabel: "Group C" }]);

  // 2. Cross-tenant read access must be strictly forbidden
  assert.equal(await stratRepo.getById(stratA.id, tenantB), null, "Tenant B cannot read Tenant A strategy");
  assert.equal(await stratRepo.getById(stratB.id, tenantA), null, "Tenant A cannot read Tenant B strategy");
  assert.equal(await chatRepo.getById(chatA.id, tenantB), null, "Tenant B cannot read Tenant A chat");
  assert.equal(await chatRepo.getById(chatB.id, tenantA), null, "Tenant A cannot read Tenant B chat");

  // 3. Tenant A deleting their own chat does not affect Tenant B
  const deletedChatA = await chatRepo.delete(chatA.id, tenantA);
  assert.equal(deletedChatA, true, "Tenant A can delete their chat");
  assert.equal(await chatRepo.getById(chatA.id, tenantA), null, "Chat A is deleted for Tenant A");
  assert.ok(await chatRepo.getById(chatB.id, tenantB), "Chat B remains intact for Tenant B");

  // 4. Cascade deletion of Tenant A leaves Tenant B and C completely intact
  await stratRepo.deleteAllByOwner(tenantA);
  await chatRepo.deleteAllByOwner(tenantA);
  await plannerRepo.deleteAllByOwner(tenantA);

  assert.equal((await stratRepo.list(tenantA)).length, 0);
  assert.equal((await chatRepo.list(tenantA)).length, 0);
  assert.equal((await plannerRepo.list(tenantA)).length, 0);

  // Tenant B and C still have all their data
  assert.equal((await stratRepo.list(tenantB)).length, 1);
  assert.equal((await chatRepo.list(tenantB)).length, 1);
  assert.equal((await plannerRepo.list(tenantB)).length, 1);
  assert.equal((await plannerRepo.list(tenantC)).length, 1);

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Tier 3 - Combination 2: Guest claim-to-user workflows", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tier3-claim-"));
  const stratRepo = new FileStrategyRepository(path.join(tmpDir, "strats.json"));
  const chatRepo = new FileChatRepository(path.join(tmpDir, "chats.json"));

  const guestId = `guest_${randomUUID()}`;
  const registeredUserId = `usr_${randomUUID()}`;

  const strategyData = {
    title: "Guest Strategy",
    summary: "Created during unauthenticated browsing",
    context: {},
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  };

  // 1. Guest creates assets before registering
  const guestStrat1 = await stratRepo.create({
    clientSaveId: "guest_save_1",
    brief: "Guest brief 1",
    answers: [],
    strategy: strategyData,
    versions: [{ versionNumber: 1, data: strategyData, createdAt: new Date().toISOString() }],
  }, guestId);

  const guestStrat2 = await stratRepo.create({
    clientSaveId: "guest_save_2",
    brief: "Guest brief 2",
    answers: [],
    strategy: strategyData,
    versions: [{ versionNumber: 1, data: strategyData, createdAt: new Date().toISOString() }],
  }, guestId);

  const guestChat = await chatRepo.saveChat({
    ownerId: guestId,
    title: "Guest Chat Discussion",
    messages: [
      { role: "user", content: "How do I market my startup?" },
      { role: "assistant", content: "Focus on distribution first." },
    ],
  });

  assert.equal((await stratRepo.list(guestId)).length, 2);
  assert.equal((await chatRepo.list(guestId)).length, 1);
  assert.equal((await stratRepo.list(registeredUserId)).length, 0);
  assert.equal((await chatRepo.list(registeredUserId)).length, 0);

  // 2. User signs up / logs in -> claimOwner transfers ownership atomically
  await stratRepo.claimOwner(guestId, registeredUserId);
  await chatRepo.claimOwner(guestId, registeredUserId);

  // 3. Verify guest identity now owns 0 records
  assert.equal((await stratRepo.list(guestId)).length, 0, "Guest has 0 strategies after claim");
  assert.equal((await chatRepo.list(guestId)).length, 0, "Guest has 0 chats after claim");

  // 4. Verify registered user now owns all claimed records
  const claimedStrategies = await stratRepo.list(registeredUserId);
  assert.equal(claimedStrategies.length, 2, "Registered user owns 2 claimed strategies");
  assert.ok(claimedStrategies.some((s) => s.id === guestStrat1.id));
  assert.ok(claimedStrategies.some((s) => s.id === guestStrat2.id));

  const fetchedStrat1 = await stratRepo.getById(guestStrat1.id, registeredUserId);
  assert.ok(fetchedStrat1);
  assert.equal(fetchedStrat1.ownerId, registeredUserId);

  const claimedChats = await chatRepo.list(registeredUserId);
  assert.equal(claimedChats.length, 1, "Registered user owns 1 claimed chat");
  assert.equal(claimedChats[0].id, guestChat.id);
  assert.equal(claimedChats[0].ownerId, registeredUserId);

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Tier 3 - Combination 3: Stream disconnects and abort handling during generation", async () => {
  const abortController = new AbortController();
  const chunksReceived = [];
  let generationAborted = false;

  async function* simulateModelStream(signal) {
    for (let i = 1; i <= 10; i++) {
      if (signal.aborted) {
        generationAborted = true;
        throw new Error("AbortError");
      }
      await new Promise((r) => setTimeout(r, 20));
      yield { chunk: `token_${i}`, index: i };
    }
  }

  // Start consuming stream
  const streamPromise = (async () => {
    try {
      for await (const item of simulateModelStream(abortController.signal)) {
        chunksReceived.push(item);
        // Client disconnects at token 3
        if (item.index === 3) {
          abortController.abort();
        }
      }
    } catch (err) {
      if (err.message === "AbortError" || abortController.signal.aborted) {
        return { aborted: true };
      }
      throw err;
    }
  })();

  const result = await streamPromise;
  assert.equal(result.aborted, true, "Stream cleanly terminated upon abort");
  assert.equal(chunksReceived.length, 3, "Only received tokens prior to abort");
  assert.equal(generationAborted, true, "Upstream generator acknowledged abortSignal");
});
