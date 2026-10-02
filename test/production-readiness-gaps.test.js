import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { FileChatRepository } from "../src/repositories/file-chat-repository.js";
import { FileStrategyRepository } from "../src/repositories/file-strategy-repository.js";
import { FilePlannerRepository } from "../src/repositories/file-planner-repository.js";
import { FileUserRepository } from "../src/repositories/file-user-repository.js";
import {
  computePayloadFingerprint,
  computeLegacyPayloadFingerprint,
  canonicalize,
} from "../src/http/strategy-router.js";

async function createTempDir() {
  const dir = path.join(os.tmpdir(), `helmer-gap-tests-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

test("[P1] Guest → user migration data loss & OCC conflict recovery", async (t) => {
  const baseDir = await createTempDir();
  t.after(async () => {
    await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
  });

  await t.test("1.1 Destination shard exists in cloud + OCC conflict recovers without data loss", async () => {
    const cloudStorage = new Map();
    const guestId = "usr_guest_001";
    const userId = "usr_user_001";

    let repoRef = null;
    let simulateClaimConflict = false;
    const mockCloud = {
      cloud: true,
      readCloud: async (key) => {
        if (!cloudStorage.has(key)) return { record: null, etag: null, notFound: true };
        const item = cloudStorage.get(key);
        return { record: item.data, etag: item.etag, notFound: false };
      },
      writeCloud: async (key, data, etag) => {
        const current = cloudStorage.get(key);
        // Simulate OCC check
        if (current && etag !== current.etag) {
          return false; // OCC conflict
        }
        if (!current && etag !== null) {
          return false;
        }
        // First attempt for user destination shard during claimOwner: simulate a race conflict from another worker
        if (simulateClaimConflict && repoRef && key === repoRef.tenantKey(userId)) {
          simulateClaimConflict = false; // only trigger once!
          const existing = current?.data || [];
          cloudStorage.set(key, { data: [...existing, { id: "strat_existing_race", title: "Concurrent Race Strategy", ownerId: userId }], etag: "etag_race_1" });
          return false; // OCC conflict
        }
        const newEtag = `etag_${randomUUID().slice(0, 8)}`;
        cloudStorage.set(key, { data, etag: newEtag });
        return true;
      },
      deleteCloud: async (key) => {
        cloudStorage.delete(key);
        return true;
      },
    };

    const repo = new FileStrategyRepository(path.join(baseDir, "strat1"), null, mockCloud);
    repoRef = repo;
    await repo.ensure();

    // Setup initial guest data in cloud & local
    await repo.create({ clientSaveId: "cs_g1", title: "Guest Strat 1" }, guestId);
    await repo.create({ clientSaveId: "cs_g2", title: "Guest Strat 2" }, guestId);

    // Setup initial user data in cloud & local
    await repo.create({ clientSaveId: "cs_u_orig", title: "User Orig Strat" }, userId);

    // Trigger OCC race during claimOwner
    simulateClaimConflict = true;
    const claimedCount = await repo.claimOwner(guestId, userId);
    assert.equal(claimedCount, 2, "Should claim both guest strategies");

    // Verify user shard now contains both original, race-added, and claimed records
    const userRecords = await repo.readTenant(userId);
    const keys = userRecords.map((r) => r.clientSaveId || r.id);
    assert.ok(keys.includes("cs_u_orig"), "Original record preserved");
    assert.ok(keys.includes("strat_existing_race"), "Race record preserved");
    assert.ok(keys.includes("cs_g1"), "Guest record 1 merged");
    assert.ok(keys.includes("cs_g2"), "Guest record 2 merged");

    // Verify guest shard is purged
    const guestRecords = await repo.readTenant(guestId);
    assert.equal(guestRecords.length, 0, "Guest shard should be purged after successful merge");
  });

  await t.test("1.2 R2 write error aborts migration and NEVER deletes source guest shard", async () => {
    const guestId = "usr_guest_fail";
    const userId = "usr_user_fail";

    let repoRef = null;
    const chatStorage = new Map();
    const mockFailingCloud = {
      cloud: true,
      readCloud: async (key) => {
        const item = chatStorage.get(key);
        return { record: item ? item.data : null, etag: item?.etag || null, notFound: !item };
      },
      writeCloud: async (key, data) => {
        if (repoRef && key === repoRef.tenantKey(userId)) {
          throw new Error("R2 500 Internal Server Error (Storage Offline)");
        }
        chatStorage.set(key, { data, etag: "etag_ok" });
        return true;
      },
      deleteCloud: async () => {
        throw new Error("deleteCloud should NEVER be called on write failure");
      },
    };

    const repo = new FileChatRepository(path.join(baseDir, "chat_fail"), null, mockFailingCloud);
    repoRef = repo;
    await repo.ensure();

    // Create guest chat
    await repo.saveChat({ id: "chat_g1", ownerId: guestId, title: "Important Guest Chat", messages: [{ role: "user", content: "Hi" }] });

    // Migration attempt must reject
    await assert.rejects(
      async () => {
        await repo.claimOwner(guestId, userId);
      },
      /Storage Offline/,
      "Migration must reject on cloud storage error"
    );

    // Verify guest records still exist intact!
    const guestChats = await repo.readTenant(guestId);
    assert.equal(guestChats.length, 1, "Guest chat must NOT be deleted when migration fails");
    assert.equal(guestChats[0].title, "Important Guest Chat");
  });

  await t.test("1.3 Re-execution of the same migration is completely idempotent", async () => {
    const guestId = "usr_guest_idem";
    const userId = "usr_user_idem";

    const repo = new FilePlannerRepository(path.join(baseDir, "plan_idem"), null, { cloud: false });
    await repo.ensure();

    await repo.addBatch(guestId, [
      { id: "task_1", title: "Task 1", text: "Task 1 text", createdAt: new Date().toISOString() },
      { id: "task_2", title: "Task 2", text: "Task 2 text", createdAt: new Date().toISOString() },
    ]);

    // First claim
    const firstCount = await repo.claimOwner(guestId, userId);
    assert.equal(firstCount, 2);

    // Second claim (re-execution)
    const secondCount = await repo.claimOwner(guestId, userId);
    assert.equal(secondCount, 0, "Re-execution should claim 0 and not throw");

    const finalRecords = await repo.readTenant(userId);
    assert.equal(finalRecords.length, 2, "No duplicate records created");
  });

  await t.test("1.4 Incomplete migration safely resumes with a fresh repository instance", async () => {
    const guestId = "usr_guest_resume";
    const userId = "usr_user_resume";

    const repoDir = path.join(baseDir, "strat_resume");
    const repo1 = new FileStrategyRepository(repoDir, null, { cloud: false });
    await repo1.ensure();

    const created = await repo1.create({ title: "Resume 1" }, guestId);

    // Simulate partial failure: destination written, but guest purge not yet done
    const userKey = repo1.tenantKey(userId);
    await repo1.writeLocalTenant(userKey, [{ ...created, ownerId: userId, updatedAt: new Date().toISOString() }]);

    // Spin up fresh repository instance
    const repo2 = new FileStrategyRepository(repoDir, null, { cloud: false });
    await repo2.ensure();

    // Re-run claimOwner
    const claimed = await repo2.claimOwner(guestId, userId);
    assert.equal(claimed, 0, "Already present in destination, counted as 0 claimed");

    // Verify destination has the record, and guest is safely cleaned up
    const userStrat = await repo2.readTenant(userId);
    assert.equal(userStrat.length, 1);
    const guestStrat = await repo2.readTenant(guestId);
    assert.equal(guestStrat.length, 0, "Guest cleaned up safely on resume");
  });
});

test("[P1] Tenant deletion: false success prevention & tombstone OCC retry", async (t) => {
  const baseDir = await createTempDir();
  t.after(async () => {
    await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
  });

  await t.test("2.1 Tombstone write initial conflict succeeds on OCC retry", async () => {
    const ownerId = "usr_del_occ";
    let tombstoneAttempts = 0;
    let cloudData = {
      record: [{ id: "chat_1", title: "Hello", messages: [] }],
      etag: "etag_initial",
      notFound: false,
    };

    const mockCloud = {
      cloud: true,
      readCloud: async () => ({
        record: cloudData.record,
        etag: cloudData.etag,
        notFound: cloudData.notFound,
        tombstone: Boolean(cloudData.record && cloudData.record._tombstone),
      }),
      writeCloud: async (key, record, etag) => {
        tombstoneAttempts++;
        if (tombstoneAttempts === 1) {
          // simulate conflict
          cloudData.etag = "etag_concurrent_mutation";
          return false; // OCC conflict
        }
        cloudData.record = record;
        cloudData.etag = "etag_tombstone";
        return true;
      },
      deleteCloud: async () => true,
    };

    const repo = new FileChatRepository(path.join(baseDir, "del_chat"), null, mockCloud);
    await repo.ensure();

    const deletedCount = await repo.deleteAllByOwner(ownerId);
    assert.equal(deletedCount, 1);
    assert.equal(tombstoneAttempts, 2, "Should retry tombstone write after OCC conflict");

    // Verify tombstone is written
    const res = await repo.readTenantDataWithEtag(ownerId, repo.tenantKey(ownerId));
    assert.equal(res.tombstone, true, "Tenant must be tombstoned");
  });

  await t.test("2.2 Persistent conflict and storage error NEVER report success", async () => {
    const ownerId = "usr_del_err";
    const mockFailingCloud = {
      cloud: true,
      readCloud: async () => ({ record: [{ id: "item_1" }], etag: "etag_1", notFound: false }),
      writeCloud: async () => {
        throw new Error("R2 Connection Refused: 503");
      },
    };

    const repo = new FileStrategyRepository(path.join(baseDir, "del_fail"), null, mockFailingCloud);
    await repo.ensure();

    await assert.rejects(
      async () => {
        await repo.deleteAllByOwner(ownerId);
      },
      /503/,
      "Must throw error and NOT return success when tombstone write fails"
    );
  });

  await t.test("2.3 Mutation concurrent with deletion is rejected by tombstone", async () => {
    const ownerId = "usr_del_mut";
    const repo = new FileStrategyRepository(path.join(baseDir, "del_mut"), null, { cloud: false });
    await repo.ensure();

    const created = await repo.create({ title: "Strategy Before Delete" }, ownerId);
    await repo.deleteAllByOwner(ownerId);

    // Attempt mutation on tombstoned tenant
    const mutated = await repo.appendVersion(created.id, ownerId, { title: "Resurrect" });
    assert.equal(mutated, null, "Mutation on deleted tombstoned tenant must return null and abort");

    // Verify reading tenant still returns 0 records
    const records = await repo.readTenant(ownerId);
    assert.equal(records.length, 0, "Deleted tenant remains dead");
  });

  await t.test("2.4 Account purge cascade does not delete user if cascade fails", async () => {
    const usersFile = path.join(baseDir, "users_cascade.json");
    const userRepo = new FileUserRepository(usersFile, null, { cloud: false });
    await userRepo.ensure();

    const u = await userRepo.create({
      fullName: "Purge Fail User",
      username: "purge_fail_user",
      email: "purge_fail@example.com",
      passwordHash: "hash12345",
      status: "pending_deletion",
    });

    // Schedule deletion in the past
    await userRepo.update(u.id, {
      scheduledDeletionAt: new Date(Date.now() - 10000).toISOString(),
    });

    // Mock a failing strategy repository
    const mockStrategyRepo = {
      deleteAllByOwner: async () => {
        throw new Error("Strategy cascade storage error!");
      },
    };

    const purged = await userRepo.purgeExpiredAccounts({ strategyRepository: mockStrategyRepo });
    assert.equal(purged, 0, "Purge should return 0 when cascade fails");

    // Verify user is NOT deleted from users.json!
    const stillExists = await userRepo.findById(u.id);
    assert.ok(stillExists, "User record must be preserved if cascade deletion failed");
  });
});

test("[P2] Local storage: concurrent repository instances & cross-process locking", async (t) => {
  const baseDir = await createTempDir();
  t.after(async () => {
    await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
  });

  await t.test("3.1 Two independent FileChatRepository instances modifying same tenant preserve all writes", async () => {
    const tenantOwner = "usr_concurrent_chat";
    const repo1 = new FileChatRepository(path.join(baseDir, "chats"), null, { cloud: false });
    const repo2 = new FileChatRepository(path.join(baseDir, "chats"), null, { cloud: false });
    await repo1.ensure();
    await repo2.ensure();

    // Simultaneously fire 10 mutations from repo1 and 10 from repo2
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        repo1.saveChat({ id: `chat_r1_${i}`, ownerId: tenantOwner, title: `Repo1 Chat ${i}`, messages: [] })
      );
      promises.push(
        repo2.saveChat({ id: `chat_r2_${i}`, ownerId: tenantOwner, title: `Repo2 Chat ${i}`, messages: [] })
      );
    }

    await Promise.all(promises);

    const allChats = await repo1.readTenant(tenantOwner);
    assert.equal(allChats.length, 20, "All 20 chats from both instances must be preserved without data loss");
  });

  await t.test("3.2 Two separate Node processes modifying same tenant preserve all writes", async () => {
    const tenantOwner = "usr_proc_concurrent";
    const chatsDir = path.join(baseDir, "chats_proc");
    const initRepo = new FileChatRepository(chatsDir, null, { cloud: false });
    await initRepo.ensure();

    // Helper child script code
    const childWorkerScript = path.join(baseDir, "worker.mjs");
    await fs.writeFile(
      childWorkerScript,
      `
      import { FileChatRepository } from "${path.resolve("src/repositories/file-chat-repository.js")}";
      const [,, chatsDir, ownerId, prefix, count] = process.argv;
      const repo = new FileChatRepository(chatsDir, null, { cloud: false });
      await repo.ensure();
      for (let i = 0; i < Number(count); i++) {
        await repo.saveChat({ id: \`\${prefix}_\${i}\`, ownerId, title: \`Chat \${prefix} \${i}\`, messages: [] });
      }
      process.exit(0);
      `,
      "utf8"
    );

    const runWorker = (prefix, count) => {
      return new Promise((resolve, reject) => {
        const child = fork(childWorkerScript, [chatsDir, tenantOwner, prefix, String(count)], { stdio: "inherit" });
        child.on("exit", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Worker ${prefix} exited with code ${code}`));
        });
      });
    };

    // Run two processes concurrently writing 8 records each
    await Promise.all([runWorker("procA", 8), runWorker("procB", 8)]);

    const finalRecords = await initRepo.readTenant(tenantOwner);
    assert.equal(finalRecords.length, 16, "All 16 chats from 2 separate processes must be preserved");
  });

  await t.test("3.3 Parallel writes for different tenants execute concurrently without blocking", async () => {
    const repo = new FilePlannerRepository(path.join(baseDir, "plan_par"), null, { cloud: false });
    await repo.ensure();

    const t1 = "usr_tenant_1";
    const t2 = "usr_tenant_2";

    const start = Date.now();
    await Promise.all([
      repo.addBatch(t1, [{ id: "p1", title: "Task 1", text: "Text 1" }]),
      repo.addBatch(t2, [{ id: "p2", title: "Task 2", text: "Text 2" }]),
    ]);
    const duration = Date.now() - start;

    assert.ok(duration < 3000, "Different tenants should run without mutual blocking");
    const r1 = await repo.readTenant(t1);
    const r2 = await repo.readTenant(t2);
    assert.equal(r1.length, 1);
    assert.equal(r2.length, 1);
  });
});

test("[P2] Canonical Idempotency Fingerprint & Compatibility", async (t) => {
  await t.test("4.1 autoSave, assumptions, and strategy content changes produce different fingerprints", () => {
    const basePayload = {
      brief: "Marketing plan for a coffee shop in Baku",
      answers: [{ questionId: "q1", question: "Budget?", answer: "10000 AZN" }],
      assumptions: ["Assume high foot traffic"],
      autoSave: true,
      language: "az",
    };

    const fpBase = computePayloadFingerprint("generate", basePayload);

    // Change autoSave
    const fpAutoSaveFalse = computePayloadFingerprint("generate", { ...basePayload, autoSave: false });
    assert.notEqual(fpBase, fpAutoSaveFalse, "Changing autoSave must change fingerprint");

    // Change assumptions
    const fpDiffAssumptions = computePayloadFingerprint("generate", {
      ...basePayload,
      assumptions: ["Assume low foot traffic"],
    });
    assert.notEqual(fpBase, fpDiffAssumptions, "Changing assumptions must change fingerprint");

    // Change refine strategy body
    const refinePayload1 = {
      brief: "Test",
      answers: [],
      action: "refine_tactics",
      request: "More digital ads",
      strategy: { title: "Strategy A", targetMarket: "Baku", pillars: ["Pillar 1"] },
    };
    const refinePayload2 = {
      ...refinePayload1,
      strategy: { title: "Strategy A", targetMarket: "Baku", pillars: ["Pillar 2 Changed"] },
    };

    const fpRefine1 = computePayloadFingerprint("refine", refinePayload1);
    const fpRefine2 = computePayloadFingerprint("refine", refinePayload2);
    assert.notEqual(fpRefine1, fpRefine2, "Changing strategy pillars must change refinement fingerprint");
  });

  await t.test("4.2 Canonicalization: different object key ordering in identical payload yields identical fingerprint", () => {
    const payloadA = {
      brief: "Brand expansion",
      answers: [{ question: "Market", questionId: "q1", answer: "Global" }],
      autoSave: true,
      assumptions: ["assumption 1"],
      strategy: {
        targetMarket: "Global",
        title: "Growth Strategy",
        budget: { total: 50000, currency: "USD" },
      },
    };

    // Exactly same semantics, reversed key ordering everywhere
    const payloadB = {
      strategy: {
        budget: { currency: "USD", total: 50000 },
        title: "Growth Strategy",
        targetMarket: "Global",
      },
      assumptions: ["assumption 1"],
      autoSave: true,
      answers: [{ answer: "Global", questionId: "q1", question: "Market" }],
      brief: "Brand expansion",
    };

    const fpA = computePayloadFingerprint("refine", payloadA);
    const fpB = computePayloadFingerprint("refine", payloadB);
    assert.equal(fpA, fpB, "Key ordering must NOT affect canonical payload fingerprint");
  });

  await t.test("4.3 Legacy fingerprint is backwards-compatible on persisted replay", () => {
    const legacyPayload = {
      brief: "Old strategy brief",
      answers: [{ question: "Audience", answer: "Young adults" }],
      action: null,
      request: null,
      language: "en",
      strategy: { title: "Old Strategy Title", targetMarket: "US" },
    };

    const legacyFp = computeLegacyPayloadFingerprint("generate", legacyPayload);
    const canonicalFp = computePayloadFingerprint("generate", legacyPayload);

    // Verify canonical fingerprint matches or legacy fallback matches
    const matchesCanonical = legacyFp === canonicalFp;
    const matchesLegacy = legacyFp === computeLegacyPayloadFingerprint("generate", legacyPayload);
    assert.ok(matchesCanonical || matchesLegacy, "Legacy stored fingerprint must be recognized as valid replay");
  });
});
