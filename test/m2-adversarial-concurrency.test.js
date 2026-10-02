import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { FileStrategyRepository } from "../src/repositories/file-strategy-repository.js";
import { FileChatRepository } from "../src/repositories/file-chat-repository.js";
import { FilePlannerRepository } from "../src/repositories/file-planner-repository.js";
import { FileTelemetryRepository } from "../src/repositories/file-telemetry-repository.js";
import { createAskExecutionGuard } from "../src/http/ask-execution-guard.js";

function sampleStrategy(title = "Concurrency Test Strategy") {
  return {
    title,
    summary: "Stress test summary",
    context: {
      business: "E-Commerce",
      objective: "Scale operations",
      market: "Baku",
      targetAudience: "Online shoppers",
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

class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = 200;
    this.body = null;
  }
  status(code) {
    this.statusCode = code;
    return this;
  }
  json(data) {
    this.body = data;
    this.emit("finish");
    return this;
  }
}

// ============================================================================
// SUITE 1: Multi-Tenant Simultaneous Writes (10 tenants concurrently)
// ============================================================================

test("SUITE 1.1: 10 tenants simultaneously create strategies with 100% data retention and zero cross-tenant leakage", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-strategy-multitenant-"));
  const repo = new FileStrategyRepository(tmpDir);
  await repo.ensure();

  const TENANT_COUNT = 10;
  const WRITES_PER_TENANT = 5;
  const tenants = Array.from({ length: TENANT_COUNT }, (_, i) => `tenant-strategy-${i + 1}`);

  // Execute 50 concurrent writes across 10 tenants
  const tasks = [];
  for (const tenantId of tenants) {
    for (let w = 0; w < WRITES_PER_TENANT; w++) {
      const clientSaveId = `save-${tenantId}-${w}`;
      const payload = {
        clientSaveId,
        brief: `Brief for ${tenantId} run ${w}`,
        answers: [],
        strategy: sampleStrategy(`Strategy ${tenantId} #${w}`),
        versions: [
          {
            versionNumber: 1,
            data: sampleStrategy(`Strategy ${tenantId} #${w}`),
            changeRequest: "Initial creation",
            createdAt: new Date().toISOString(),
          },
        ],
      };
      tasks.push(repo.create(payload, tenantId));
    }
  }

  const results = await Promise.all(tasks);
  assert.equal(results.length, TENANT_COUNT * WRITES_PER_TENANT);

  // Verify 100% retention and zero leakage
  for (const tenantId of tenants) {
    const list = await repo.list(tenantId);
    assert.equal(list.length, WRITES_PER_TENANT, `Tenant ${tenantId} must have exactly ${WRITES_PER_TENANT} strategies`);

    for (const item of list) {
      const fetched = await repo.getById(item.id, tenantId);
      assert.ok(fetched, `Strategy ${item.id} must be fetchable by owner`);
      assert.equal(fetched.ownerId, tenantId, "Record ownerId must strictly match requested tenant");

      // Cross-tenant IDOR defense: no other tenant can access this strategy
      const otherTenant = tenants.find((t) => t !== tenantId);
      const crossFetch = await repo.getById(item.id, otherTenant);
      assert.equal(crossFetch, null, "Cross-tenant access must return null");
    }

    const tenantRecords = await repo.readTenant(tenantId);
    assert.equal(tenantRecords.length, WRITES_PER_TENANT);
    for (const rec of tenantRecords) {
      assert.equal(rec.ownerId, tenantId, "Shard records must strictly contain ownerId");
    }
  }

  // Verify all shards exist on disk with valid JSON and no .tmp files remain
  const entries = await fs.readdir(repo.strategiesDir);
  const tmpFiles = entries.filter((e) => e.endsWith(".tmp"));
  assert.equal(tmpFiles.length, 0, "No leftover .tmp files must exist in strategies directory");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("SUITE 1.2: 10 tenants simultaneously save chats with 100% retention and zero leakage", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-chat-multitenant-"));
  const repo = new FileChatRepository(tmpDir);
  await repo.ensure();

  const TENANT_COUNT = 10;
  const CHATS_PER_TENANT = 5;
  const tenants = Array.from({ length: TENANT_COUNT }, (_, i) => `tenant-chat-${i + 1}`);

  const tasks = [];
  for (const tenantId of tenants) {
    for (let c = 0; c < CHATS_PER_TENANT; c++) {
      tasks.push(
        repo.saveChat({
          id: randomUUID(),
          ownerId: tenantId,
          title: `Chat ${c} for ${tenantId}`,
          messages: [
            { role: "user", content: `Hello from ${tenantId} #${c}` },
            { role: "assistant", content: `Response to ${tenantId} #${c}` },
          ],
        })
      );
    }
  }

  const results = await Promise.all(tasks);
  assert.equal(results.length, TENANT_COUNT * CHATS_PER_TENANT);

  for (const tenantId of tenants) {
    const list = await repo.list(tenantId);
    assert.equal(list.length, CHATS_PER_TENANT, `Tenant ${tenantId} must have exactly ${CHATS_PER_TENANT} chats`);

    for (const chat of list) {
      assert.equal(chat.ownerId, tenantId);
      const fetched = await repo.getById(chat.id, tenantId);
      assert.ok(fetched);

      const otherTenant = tenants.find((t) => t !== tenantId);
      const crossFetch = await repo.getById(chat.id, otherTenant);
      assert.equal(crossFetch, null);
    }
  }

  const entries = await fs.readdir(repo.chatsDir);
  const tmpFiles = entries.filter((e) => e.endsWith(".tmp"));
  assert.equal(tmpFiles.length, 0, "No leftover .tmp files in chats directory");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("SUITE 1.3: 10 tenants simultaneously add task batches to planner with 100% retention and zero leakage", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-planner-multitenant-"));
  const repo = new FilePlannerRepository(tmpDir);
  await repo.ensure();

  const TENANT_COUNT = 10;
  const BATCHES_PER_TENANT = 4;
  const TASKS_PER_BATCH = 3;
  const tenants = Array.from({ length: TENANT_COUNT }, (_, i) => `tenant-planner-${i + 1}`);

  const tasks = [];
  for (const tenantId of tenants) {
    for (let b = 0; b < BATCHES_PER_TENANT; b++) {
      const batchItems = Array.from({ length: TASKS_PER_BATCH }, (_, k) => ({
        title: `Task T${b}-${k} for ${tenantId}`,
        timeframe: "Bu həftə",
        priority: k === 0 ? "high" : "normal",
      }));
      tasks.push(repo.addBatch(tenantId, batchItems));
    }
  }

  await Promise.all(tasks);

  for (const tenantId of tenants) {
    const list = await repo.list(tenantId);
    assert.equal(
      list.length,
      BATCHES_PER_TENANT * TASKS_PER_BATCH,
      `Tenant ${tenantId} must retain all ${BATCHES_PER_TENANT * TASKS_PER_BATCH} tasks`
    );
    for (const task of list) {
      assert.equal(task.ownerId, tenantId);
    }
  }

  const entries = await fs.readdir(repo.plannerDir);
  const tmpFiles = entries.filter((e) => e.endsWith(".tmp"));
  assert.equal(tmpFiles.length, 0, "No leftover .tmp files in planner directory");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// SUITE 2: In-Process Race Serialization for Same-Tenant Mutations
// ============================================================================

test("SUITE 2.1: Same-tenant concurrent create operations are serialized without clobbering", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-same-tenant-create-"));
  const repo = new FileStrategyRepository(tmpDir);
  await repo.ensure();

  const OWNER_ID = "isolated-tenant-race-1";
  const CONCURRENT_OPS = 20;

  // 20 simultaneous create operations for the exact same ownerId
  const ops = Array.from({ length: CONCURRENT_OPS }, (_, i) =>
    repo.create(
      {
        clientSaveId: `concurrent-save-${i}`,
        brief: `Brief ${i}`,
        answers: [],
        strategy: sampleStrategy(`Concurrent Strategy ${i}`),
        versions: [
          {
            versionNumber: 1,
            data: sampleStrategy(`Concurrent Strategy ${i}`),
            changeRequest: "Init",
            createdAt: new Date().toISOString(),
          },
        ],
      },
      OWNER_ID
    )
  );

  const results = await Promise.all(ops);
  assert.equal(results.length, CONCURRENT_OPS);

  const list = await repo.list(OWNER_ID);
  assert.equal(list.length, CONCURRENT_OPS, "All 20 concurrent creates must be retained without dropped updates");

  // Verify internal queue was cleaned up when idle
  assert.equal(repo.tenantQueues.size, 0, "tenantQueues must be empty when idle");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("SUITE 2.2: Same-tenant concurrent appendVersion operations strictly sequence versions without duplicates", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-same-tenant-version-"));
  const repo = new FileStrategyRepository(tmpDir);
  await repo.ensure();

  const OWNER_ID = "version-concurrency-owner";
  const initial = await repo.create(
    {
      clientSaveId: "base-version-save",
      brief: "Base strategy brief",
      answers: [],
      strategy: sampleStrategy("Base Strategy"),
      versions: [
        {
          versionNumber: 1,
          data: sampleStrategy("Base Strategy"),
          changeRequest: "V1",
          createdAt: new Date().toISOString(),
        },
      ],
    },
    OWNER_ID
  );

  const APPEND_COUNT = 15;
  const appendOps = Array.from({ length: APPEND_COUNT }, (_, i) =>
    repo.appendVersion(
      initial.id,
      OWNER_ID,
      sampleStrategy(`Refinement Step ${i + 1}`),
      `Change request #${i + 1}`
    )
  );

  const results = await Promise.all(appendOps);
  assert.equal(results.length, APPEND_COUNT);

  const finalStrategy = await repo.getById(initial.id, OWNER_ID);
  assert.ok(finalStrategy);
  assert.equal(
    finalStrategy.versions.length,
    APPEND_COUNT + 1,
    `Strategy must have exactly ${APPEND_COUNT + 1} versions`
  );

  // Check version numbers are strictly 1..16 without duplicates
  const versionNumbers = finalStrategy.versions.map((v) => v.versionNumber);
  const expectedNumbers = Array.from({ length: APPEND_COUNT + 1 }, (_, i) => i + 1);
  assert.deepEqual(versionNumbers, expectedNumbers, "Version numbers must be monotonically sequential");

  assert.equal(repo.tenantQueues.size, 0, "tenantQueues must be cleaned up");
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("SUITE 2.3: Same-tenant mixed mutations (create, update, duplicate, delete) maintain state integrity", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-mixed-mutations-"));
  const repo = new FileStrategyRepository(tmpDir);
  await repo.ensure();

  const OWNER_ID = "mixed-mutations-owner";

  // Pre-seed 3 items
  const s1 = await repo.create(
    {
      clientSaveId: "s1",
      strategy: sampleStrategy("S1"),
      versions: [
        {
          versionNumber: 1,
          data: sampleStrategy("S1"),
          changeRequest: "Initial",
          createdAt: new Date().toISOString(),
        },
      ],
    },
    OWNER_ID
  );
  const s2 = await repo.create({ clientSaveId: "s2", strategy: sampleStrategy("S2") }, OWNER_ID);
  const s3 = await repo.create({ clientSaveId: "s3", strategy: sampleStrategy("S3") }, OWNER_ID);

  // Run 15 concurrent mixed operations
  const operations = [
    repo.updateTitle(s1.id, OWNER_ID, "S1 Renamed Alpha"),
    repo.updateTitle(s2.id, OWNER_ID, "S2 Renamed Beta"),
    repo.duplicate(s3.id, OWNER_ID),
    repo.appendVersion(s1.id, OWNER_ID, sampleStrategy("S1 V2"), "refine"),
    repo.create({ clientSaveId: "s4", strategy: sampleStrategy("S4") }, OWNER_ID),
    repo.updateTitle(s1.id, OWNER_ID, "S1 Renamed Final"),
    repo.delete(s2.id, OWNER_ID),
    repo.create({ clientSaveId: "s5", strategy: sampleStrategy("S5") }, OWNER_ID),
    repo.duplicate(s1.id, OWNER_ID),
  ];

  await Promise.all(operations);

  const list = await repo.list(OWNER_ID);
  // S2 was deleted, S1 was duplicated (+1), S3 was duplicated (+1), S4 created (+1), S5 created (+1)
  // Total expected: 3 original - 1 deleted + 4 additions = 6
  assert.equal(list.length, 6, "List must contain exactly 6 strategies after mixed concurrent operations");

  // Verify s2 is gone
  assert.equal(await repo.getById(s2.id, OWNER_ID), null);

  // Verify s1 exists and has updated title and versions
  const s1Final = await repo.getById(s1.id, OWNER_ID);
  assert.ok(s1Final);
  assert.equal(s1Final.title, "S1 Renamed Final");
  assert.ok(s1Final.versions.length >= 2);

  assert.equal(repo.tenantQueues.size, 0);
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// SUITE 3: R2 Optimistic Concurrency Control (OCC) Simulation
// ============================================================================

test("SUITE 3.1: FileStrategyRepository detects R2 OCC 412 conflict, reloads fresh state, and succeeds on retry", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-strategy-r2-occ-"));

  // Simulated remote R2 object store
  let simulatedR2State = {
    records: [
      { id: "existing-strat-1", ownerId: "r2-tenant", title: "Existing Remote Strategy" },
    ],
    etag: '"etag-version-1"',
  };

  let writeAttempts = 0;
  let conflictTriggered = false;

  const mockReadCloud = async (tenantKey) => {
    return {
      record: JSON.parse(JSON.stringify(simulatedR2State.records)),
      etag: simulatedR2State.etag,
    };
  };

  const mockWriteCloud = async (tenantKey, records, etag) => {
    writeAttempts++;
    // Simulate another replica writing to R2 exactly when our first write arrives
    if (!conflictTriggered) {
      conflictTriggered = true;
      // Replica B commits first with updated etag
      simulatedR2State.records.push({
        id: "replica-b-strat",
        ownerId: "r2-tenant",
        title: "Committed by Replica B",
      });
      simulatedR2State.etag = '"etag-version-2"';
      return false; // HTTP 412 Precondition Failed
    }

    // On retry, check ETag matches current R2 state
    if (etag !== simulatedR2State.etag) {
      return false;
    }

    // Success! Update R2 state
    simulatedR2State.records = JSON.parse(JSON.stringify(records));
    simulatedR2State.etag = `"etag-version-${writeAttempts + 1}"`;
    return true;
  };

  const repo = new FileStrategyRepository(tmpDir, null, {
    cloud: true,
    readCloud: mockReadCloud,
    writeCloud: mockWriteCloud,
  });
  await repo.ensure();

  // Create strategy on our replica
  const created = await repo.create(
    {
      clientSaveId: "replica-a-save",
      brief: "Replica A Brief",
      strategy: sampleStrategy("Created by Replica A"),
    },
    "r2-tenant"
  );

  assert.ok(created);
  assert.equal(writeAttempts, 2, "Must have retried exactly once after the 412 conflict");

  // Verify that both Replica B's concurrent record AND Replica A's record are preserved!
  const finalR2Ids = simulatedR2State.records.map((r) => r.id);
  assert.ok(finalR2Ids.includes("existing-strat-1"), "Original remote record preserved");
  assert.ok(finalR2Ids.includes("replica-b-strat"), "Replica B record preserved (not clobbered)");
  assert.ok(finalR2Ids.includes(created.id), "Replica A record successfully integrated");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("SUITE 3.2: FileChatRepository retries up to 10 times and throws 503 STORAGE_BUSY if conflict persists", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-chat-r2-fail-"));

  let callCount = 0;
  const mockWriteCloudAlwaysFail = async () => {
    callCount++;
    return false; // Always 412 Precondition Failed
  };

  const repo = new FileChatRepository(tmpDir, null, {
    cloud: true,
    readCloud: async () => ({ record: [], etag: '"initial-etag"' }),
    writeCloud: mockWriteCloudAlwaysFail,
  });
  await repo.ensure();

  await assert.rejects(
    async () => {
      await repo.saveChat({
        ownerId: "r2-fail-tenant",
        title: "Will Fail",
        messages: [{ role: "user", content: "Hi" }],
      });
    },
    (err) => {
      assert.equal(err.code, "STORAGE_BUSY");
      assert.equal(err.statusCode, 503);
      return true;
    }
  );

  assert.equal(callCount, 10, "Must have retried exactly 10 times before failing");

  // Crucial check: verify that because cloud write failed, NO corrupted/partial state was written to disk
  const list = await repo.list("r2-fail-tenant");
  assert.equal(list.length, 0, "No records must be committed to local storage when cloud write fails");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("SUITE 3.3: FilePlannerRepository OCC correctly recovers and persists through multiple transient conflicts", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-planner-r2-occ-"));

  let simulatedState = {
    records: [],
    etag: '"etag-p-1"',
  };
  let attempts = 0;

  const mockWriteCloudTransient = async (tenantKey, records, etag) => {
    attempts++;
    if (attempts <= 3) {
      // Fail first 3 attempts with simulated concurrent bumps
      simulatedState.etag = `"etag-p-${attempts + 1}"`;
      return false;
    }
    // Success on 4th attempt
    simulatedState.records = JSON.parse(JSON.stringify(records));
    simulatedState.etag = `"etag-p-${attempts + 1}"`;
    return true;
  };

  const repo = new FilePlannerRepository(tmpDir, null, {
    cloud: true,
    readCloud: async () => ({
      record: JSON.parse(JSON.stringify(simulatedState.records)),
      etag: simulatedState.etag,
    }),
    writeCloud: mockWriteCloudTransient,
  });
  await repo.ensure();

  const added = await repo.addBatch("planner-occ-tenant", [
    { title: "Resilient Task 1" },
    { title: "Resilient Task 2" },
  ]);

  assert.equal(added.length, 2);
  assert.equal(attempts, 4, "Must have succeeded on the 4th attempt after 3 conflicts");

  const list = await repo.list("planner-occ-tenant");
  assert.equal(list.length, 2);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// SUITE 4: Ask Execution Guard Concurrency & Tenant Isolation
// ============================================================================

test("SUITE 4.1: 10 distinct tenants are all admitted concurrently through askExecutionGuard without blocking", async () => {
  const guard = createAskExecutionGuard({ maxConcurrent: 100 });
  const TENANT_COUNT = 10;
  const activeResponses = [];

  for (let i = 0; i < TENANT_COUNT; i++) {
    const ownerId = `ask-tenant-${i + 1}`;
    const req = {
      method: "POST",
      path: "/",
      ownerId,
      auth: { user: { emailVerifiedAt: new Date().toISOString(), id: `user-${i + 1}` } },
    };
    const res = new MockResponse();
    let nextCalled = false;

    await guard(req, res, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled, `Tenant ${ownerId} must be admitted immediately`);
    assert.equal(res.statusCode, 200);
    activeResponses.push(res);
  }

  // Cleanup: release all active connections
  for (const res of activeResponses) {
    res.emit("finish");
  }
});

test("SUITE 4.2: Concurrent request for the SAME tenant is strictly blocked with 429 EXECUTION_BUSY until released", async () => {
  const guard = createAskExecutionGuard({ maxConcurrent: 100 });
  const OWNER_ID = "ask-single-tenant-lock";

  const req1 = {
    method: "POST",
    path: "/",
    ownerId: OWNER_ID,
    auth: { user: { emailVerifiedAt: new Date().toISOString(), id: "user-1" } },
  };
  const res1 = new MockResponse();
  let req1Admitted = false;

  await guard(req1, res1, () => {
    req1Admitted = true;
  });
  assert.ok(req1Admitted, "Request 1 must be admitted");

  // Attempt duplicate request for the same tenant while Request 1 is still in-flight
  const req2 = {
    method: "POST",
    path: "/",
    ownerId: OWNER_ID,
    auth: { user: { emailVerifiedAt: new Date().toISOString(), id: "user-1" } },
  };
  const res2 = new MockResponse();
  let req2Admitted = false;

  await guard(req2, res2, () => {
    req2Admitted = true;
  });

  assert.equal(req2Admitted, false, "Request 2 must NOT be admitted while Request 1 is active");
  assert.equal(res2.statusCode, 429, "Must return HTTP 429");
  assert.equal(res2.body?.code, "EXECUTION_BUSY");

  // Finish Request 1
  res1.emit("finish");

  // Now Request 3 for the same tenant must be admitted
  const req3 = {
    method: "POST",
    path: "/",
    ownerId: OWNER_ID,
    auth: { user: { emailVerifiedAt: new Date().toISOString(), id: "user-1" } },
  };
  const res3 = new MockResponse();
  let req3Admitted = false;

  await guard(req3, res3, () => {
    req3Admitted = true;
  });

  assert.ok(req3Admitted, "Request 3 must be admitted after Request 1 finished");
  res3.emit("finish");
});

test("SUITE 4.3: Platform-wide capacity limit triggers 429 when maxConcurrent ceiling is reached", async () => {
  const MAX_LIMIT = 5;
  const guard = createAskExecutionGuard({ maxConcurrent: MAX_LIMIT });
  const responses = [];

  // Saturate capacity with 5 distinct tenants
  for (let i = 0; i < MAX_LIMIT; i++) {
    const req = {
      method: "POST",
      path: "/",
      ownerId: `tenant-cap-${i}`,
      auth: { user: { emailVerifiedAt: new Date().toISOString(), id: `u-${i}` } },
    };
    const res = new MockResponse();
    let admitted = false;
    await guard(req, res, () => {
      admitted = true;
    });
    assert.ok(admitted);
    responses.push(res);
  }

  // 6th distinct tenant arrives
  const req6 = {
    method: "POST",
    path: "/",
    ownerId: "tenant-cap-6-overflow",
    auth: { user: { emailVerifiedAt: new Date().toISOString(), id: "u-6" } },
  };
  const res6 = new MockResponse();
  let req6Admitted = false;

  await guard(req6, res6, () => {
    req6Admitted = true;
  });

  assert.equal(req6Admitted, false, "Tenant 6 must be blocked by global capacity ceiling");
  assert.equal(res6.statusCode, 429);
  assert.equal(res6.body?.code, "EXECUTION_BUSY");

  // Release one connection
  responses[0].emit("finish");

  // Now another tenant can enter
  const req7 = {
    method: "POST",
    path: "/",
    ownerId: "tenant-cap-7",
    auth: { user: { emailVerifiedAt: new Date().toISOString(), id: "u-7" } },
  };
  const res7 = new MockResponse();
  let req7Admitted = false;

  await guard(req7, res7, () => {
    req7Admitted = true;
  });

  assert.ok(req7Admitted, "New tenant admitted once capacity freed up");
  for (const r of responses.slice(1)) r.emit("finish");
  res7.emit("finish");
});

// ============================================================================
// SUITE 5: Scale Stress: 20 Tenants x 10 Concurrent Writes (200 Total Operations)
// ============================================================================

test("SUITE 5.1: 20 distinct tenants simultaneously perform 10 writes each (200 concurrent operations) with 100% record retention", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-scale-200-"));
  const repo = new FileStrategyRepository(tmpDir);
  await repo.ensure();

  const TENANT_COUNT = 20;
  const WRITES_PER_TENANT = 10;
  const tenants = Array.from({ length: TENANT_COUNT }, (_, i) => `scale-tenant-${i + 1}`);

  const allTasks = [];
  for (const tenantId of tenants) {
    for (let w = 0; w < WRITES_PER_TENANT; w++) {
      allTasks.push(
        repo.create(
          {
            clientSaveId: `scale-save-${tenantId}-${w}`,
            brief: `Scale Brief ${w} for ${tenantId}`,
            strategy: sampleStrategy(`Scale Strategy ${w}`),
          },
          tenantId
        )
      );
    }
  }

  const results = await Promise.all(allTasks);
  assert.equal(results.length, TENANT_COUNT * WRITES_PER_TENANT);

  for (const tenantId of tenants) {
    const list = await repo.list(tenantId);
    assert.equal(
      list.length,
      WRITES_PER_TENANT,
      `Tenant ${tenantId} must retain exactly ${WRITES_PER_TENANT} strategies`
    );
  }

  // Verify disk shards
  const entries = await fs.readdir(repo.strategiesDir);
  const tmpFiles = entries.filter((e) => e.endsWith(".tmp"));
  assert.equal(tmpFiles.length, 0, "Zero .tmp files must remain after 200 concurrent writes");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// SUITE 6: Bidirectional claimOwner & Concurrent Mutation Deadlock Resistance
// ============================================================================

test("SUITE 6.1: Concurrent bidirectional claimOwner (A->B and B->A) never deadlocks and maintains data consistency", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-bidirectional-claim-"));
  const repo = new FileStrategyRepository(tmpDir);
  await repo.ensure();

  const TENANT_A = "tenant-bidirectional-a";
  const TENANT_B = "tenant-bidirectional-b";

  // Pre-populate records in both
  await repo.create({ clientSaveId: "a-1", strategy: sampleStrategy("Strategy A1") }, TENANT_A);
  await repo.create({ clientSaveId: "a-2", strategy: sampleStrategy("Strategy A2") }, TENANT_A);
  await repo.create({ clientSaveId: "b-1", strategy: sampleStrategy("Strategy B1") }, TENANT_B);
  await repo.create({ clientSaveId: "b-2", strategy: sampleStrategy("Strategy B2") }, TENANT_B);

  // Concurrently execute claim A->B, claim B->A, and a new create on B
  const [claim1, claim2, created] = await Promise.all([
    repo.claimOwner(TENANT_A, TENANT_B),
    repo.claimOwner(TENANT_B, TENANT_A),
    repo.create({ clientSaveId: "b-3", strategy: sampleStrategy("Strategy B3") }, TENANT_B),
  ]);

  // One of the claims runs first and moves records, the other handles remaining or already claimed
  // Crucial check: Neither operation timed out / deadlocked, both completed
  assert.ok(typeof claim1 === "number");
  assert.ok(typeof claim2 === "number");
  assert.ok(created);

  // Verify total strategies across both shards equals total created (5 strategies)
  const allStrategies = await repo.readAll();
  assert.equal(allStrategies.length, 5, "Total strategies across all shards must be exactly 5 (zero loss)");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// SUITE 7: Telemetry Repository Concurrent Writes & Atomic Temp Safety
// ============================================================================

test("SUITE 7.1: FileTelemetryRepository records 50 concurrent events without dropped updates or temp collisions", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-telemetry-"));
  const teleFilePath = path.join(tmpDir, "telemetry.json");
  const repo = new FileTelemetryRepository(teleFilePath, null, { mirrorToR2: false });
  await repo.ensure();

  const EVENT_COUNT = 50;
  const events = Array.from({ length: EVENT_COUNT }, (_, i) => ({
    id: `tele-event-${i}`,
    timestamp: new Date().toISOString(),
    mode: "build",
    status: "success",
    maskedUserId: `usr_anon_${i}`,
    latencyMs: 100 + i,
  }));

  const recorded = await Promise.all(events.map((e) => repo.recordEvent(e)));
  assert.equal(recorded.length, EVENT_COUNT);

  const store = await repo.readStore();
  assert.equal(store.events.length, EVENT_COUNT, "All 50 events must be persisted");

  // Check that no temporary files remain
  const files = await fs.readdir(tmpDir);
  const tmpFiles = files.filter((f) => f.endsWith(".tmp"));
  assert.equal(tmpFiles.length, 0, "No .tmp files remaining in telemetry storage directory");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// SUITE 8: Dirty Temp Files & Malformed Shard Resilience
// ============================================================================

test("SUITE 8.1: readAll ignores orphaned .tmp files and malformed JSON shards gracefully", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m2-dirty-files-"));
  const repo = new FileStrategyRepository(tmpDir);
  await repo.ensure();

  // Create valid strategy
  await repo.create({ clientSaveId: "valid-1", strategy: sampleStrategy("Valid Strategy") }, "good-tenant");

  // Drop an orphaned .tmp file into strategiesDir
  const orphanedTmp = path.join(repo.strategiesDir, `orphaned-shard.${process.pid}.${randomUUID()}.tmp`);
  await fs.writeFile(orphanedTmp, JSON.stringify([{ id: "ghost-id", title: "Should not appear" }]), "utf8");

  // Drop a corrupt JSON file
  const corruptFile = path.join(repo.strategiesDir, "corrupted-shard.json");
  await fs.writeFile(corruptFile, "{ invalid json content truncated...", "utf8");

  // readAll should ignore the .tmp file and gracefully ignore the malformed file
  const all = await repo.readAll();
  assert.equal(all.length, 1, "Only the 1 valid strategy should be returned");
  assert.equal(all[0].clientSaveId, "valid-1");

  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// SUITE 9: Ask Execution Guard Abort Propagation via res.close
// ============================================================================

test("SUITE 9.1: Client disconnect via res.emit('close') immediately releases per-tenant ask guard lock", async () => {
  const guard = createAskExecutionGuard({ maxConcurrent: 100 });
  const OWNER_ID = "ask-disconnect-tenant";

  const req1 = {
    method: "POST",
    path: "/",
    ownerId: OWNER_ID,
    auth: { user: { emailVerifiedAt: new Date().toISOString(), id: "user-disc" } },
  };
  const res1 = new MockResponse();
  let req1Admitted = false;

  await guard(req1, res1, () => {
    req1Admitted = true;
  });
  assert.ok(req1Admitted);

  // Client prematurely closes connection
  res1.emit("close");

  // Immediate subsequent request must be admitted
  const req2 = {
    method: "POST",
    path: "/",
    ownerId: OWNER_ID,
    auth: { user: { emailVerifiedAt: new Date().toISOString(), id: "user-disc" } },
  };
  const res2 = new MockResponse();
  let req2Admitted = false;

  await guard(req2, res2, () => {
    req2Admitted = true;
  });

  assert.ok(req2Admitted, "Subsequent request admitted immediately after res.close");
  res2.emit("finish");
});
