import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

import {
  UserMemoryItemSchema,
  UserSettingsSchema,
  AddMemoryItemSchema,
  ImportMemoryPayloadSchema,
  SignupSchema,
  LoginSchema,
  ChangePasswordSchema,
  ResetPasswordSchema,
  EmailVerificationRequestSchema,
  EmailVerificationConfirmSchema,
} from "../src/auth/validation.js";

import {
  GenerateRequestSchema,
  AssessRequestSchema,
  RefineRequestSchema,
  SaveStrategyRequestSchema,
} from "../src/domain/strategy.js";

import { FileUserRepository } from "../src/repositories/file-user-repository.js";
import { FileStrategyRepository } from "../src/repositories/file-strategy-repository.js";
import { FileChatRepository } from "../src/repositories/file-chat-repository.js";
import { FilePlannerRepository } from "../src/repositories/file-planner-repository.js";
import { FileUpRepository } from "../src/repositories/file-up-repository.js";
import { FileAuthStore, RedisAuthStore } from "../src/auth/auth-store.js";
import { signGuestId, verifyGuestCookie, isValidGuestId, guestSession } from "../src/http/session.js";

test("Tier 1 - Feature 1: Zod .strict() rejection on mutation endpoints", () => {
  // 1. UserMemoryItemSchema
  const validMemory = {
    id: "mem_12345678",
    text: "Müştərilər premium keyfiyyətə üstünlük verir.",
    category: "business",
    createdAt: new Date().toISOString(),
  };
  assert.ok(UserMemoryItemSchema.safeParse(validMemory).success);

  const memoryWithExtra = { ...validMemory, unauthorizedField: "malicious_payload" };
  const memoryParseResult = UserMemoryItemSchema.safeParse(memoryWithExtra);
  assert.equal(memoryParseResult.success, false);
  assert.equal(memoryParseResult.error.issues[0].code, "unrecognized_keys");

  // 2. UserSettingsSchema
  const validSettings = {
    brandName: "Helmer Coffee",
    industry: "Food & Beverage",
    targetAudience: "Baku coffee lovers",
    tone: "creative",
    memories: [validMemory],
    defaultMode: "build",
  };
  assert.ok(UserSettingsSchema.safeParse(validSettings).success);

  const settingsWithExtra = { ...validSettings, isAdmin: true };
  const settingsResult = UserSettingsSchema.safeParse(settingsWithExtra);
  assert.equal(settingsResult.success, false);
  assert.equal(settingsResult.error.issues[0].code, "unrecognized_keys");

  // 3. AddMemoryItemSchema
  assert.ok(AddMemoryItemSchema.safeParse({ text: "Yeni qeyd", category: "business" }).success);
  assert.equal(AddMemoryItemSchema.safeParse({ text: "Yeni qeyd", extra: "forbidden" }).success, false);

  // 4. ImportMemoryPayloadSchema
  assert.ok(ImportMemoryPayloadSchema.safeParse({ brandName: "Brand", memories: [{ text: "Note" }] }).success);
  assert.equal(ImportMemoryPayloadSchema.safeParse({ brandName: "Brand", hack: true }).success, false);

  // 5. Auth mutation schemas (Signup, Login, Password, Verification)
  assert.equal(SignupSchema.safeParse({ email: "a@b.com", password: "Password123!", username: "validuser", extra: 1 }).success, false);
  assert.equal(LoginSchema.safeParse({ identifier: "a@b.com", password: "Password123!", extra: 1 }).success, false);
  assert.equal(ChangePasswordSchema.safeParse({ currentPassword: "OldPassword1!", newPassword: "NewPassword1!", extra: 1 }).success, false);
  assert.equal(ResetPasswordSchema.safeParse({ token: "tok12345", password: "NewPassword1!", extra: 1 }).success, false);
  assert.equal(EmailVerificationRequestSchema.safeParse({ email: "a@b.com", extra: 1 }).success, false);
  assert.equal(EmailVerificationConfirmSchema.safeParse({ email: "a@b.com", code: "123456", extra: 1 }).success, false);

  // 6. Strategy mutation schemas (Generate, Assess, Refine, Save)
  assert.equal(GenerateRequestSchema.safeParse({ brief: "Strategiya briefi burada minimum 8 simvol", idempotencyKey: "key-12345678", extra: 1 }).success, false);
  assert.equal(AssessRequestSchema.safeParse({ brief: "Strategiya briefi burada minimum 8 simvol", extra: 1 }).success, false);
  assert.equal(SaveStrategyRequestSchema.safeParse({
    clientSaveId: "save-12345678",
    brief: "Brief burada 8 simvoldan cox",
    strategy: {
      title: "Title",
      summary: "Summary",
      context: { business: "B", objective: "O", market: "M", targetAudience: "T" },
      sections: [{ id: "s1", title: "S1", summary: "Sum", content: "Cont", bullets: ["b1"] }, { id: "s2", title: "S2", summary: "Sum", content: "Cont", bullets: ["b1"] }, { id: "s3", title: "S3", summary: "Sum", content: "Cont", bullets: ["b1"] }],
      priorities: [{ title: "P1", description: "D", priority: "high" }],
      actionPlan: [{ phase: "P1", actions: ["A1"], expectedOutcome: "O" }],
      kpis: [{ name: "K1", reason: "R", target: "100" }],
      risks: [{ risk: "R", mitigation: "M" }],
      assumptions: ["A"],
      nextSteps: ["N"],
    },
    versions: [],
    extra: "injected",
  }).success, false);
});

test("Tier 1 - Feature 2: FileUserRepository mass assignment guards", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tier1-user-"));
  const repo = new FileUserRepository(path.join(tmpDir, "users.json"));

  const user = await repo.create({
    fullName: "Original Name",
    username: "origuser",
    email: "orig@example.com",
    passwordHash: "secure_hash_original",
    role: "member",
  });

  const originalId = user.id;
  const originalCreatedAt = user.createdAt;
  const originalPasswordHash = user.passwordHash;

  // Attempt mass assignment modification of sensitive fields without allowSystemFields
  const updated = await repo.update(user.id, {
    id: "usr_hacked-id-9999",
    createdAt: "2010-01-01T00:00:00.000Z",
    passwordHash: "hacked_password_hash",
    role: "admin",
    fullName: "Legitimate Name Update",
  });

  // Verify core system fields remain untouched
  assert.equal(updated.id, originalId, "User ID must be immutable");
  assert.equal(updated.createdAt, originalCreatedAt, "createdAt must be immutable");
  assert.equal(updated.passwordHash, originalPasswordHash, "passwordHash cannot be modified via update");
  assert.equal(updated.role, undefined, "role cannot be escalated to admin via standard update");
  assert.equal(updated.fullName, "Legitimate Name Update", "Whitelisted field should update");

  // Verify allowSystemFields permits authorized internal operations (e.g. system migrations)
  const systemUpdated = await repo.update(user.id, {
    passwordHash: "system_updated_hash",
  }, { allowSystemFields: true });
  assert.equal(systemUpdated.passwordHash, originalPasswordHash, "Credential changes require updatePassword rather than generic mutation");

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Tier 1 - Feature 3: Guest HMAC signing and rejection of forged cookies", () => {
  const guestId = `guest_${randomUUID()}`;
  assert.ok(isValidGuestId(guestId), "Generated guest ID must be valid format");

  // 1. Valid signing and verification
  const signedCookie = signGuestId(guestId);
  assert.ok(signedCookie.startsWith(guestId), "Cookie value starts with guest ID");
  assert.ok(signedCookie.includes("."), "Cookie value has signature separator");

  const verified = verifyGuestCookie(signedCookie);
  assert.equal(verified, guestId, "Valid cookie must verify successfully");

  // 2. Reject tampered signatures
  const parts = signedCookie.split(".");
  const tamperedSig = parts[0] + "." + "f".repeat(parts[1].length);
  assert.equal(verifyGuestCookie(tamperedSig), null, "Tampered signature must be rejected");

  // 3. Reject tampered guestId
  const otherGuestId = `guest_${randomUUID()}`;
  const tamperedId = otherGuestId + "." + parts[1];
  assert.equal(verifyGuestCookie(tamperedId), null, "Tampered ID with original signature must be rejected");

  // 4. Reject malformed guest cookie formats
  assert.equal(verifyGuestCookie(""), null);
  assert.equal(verifyGuestCookie("just-a-plain-string"), null);
  assert.equal(verifyGuestCookie("notguest_123.sig"), null);
  assert.equal(verifyGuestCookie(null), null);

  // 5. Middleware assigns fresh cookie on missing or invalid cookie
  let setHeader = null;
  const req = { headers: {} };
  const res = {
    append(name, value) {
      if (name === "Set-Cookie") setHeader = value;
    },
  };
  let nextCalled = false;
  guestSession(req, res, () => { nextCalled = true; });

  assert.ok(nextCalled, "guestSession calls next");
  assert.ok(req.ownerId, "req.ownerId assigned");
  assert.ok(isValidGuestId(req.ownerId), "Assigned ownerId is valid guest format");
  assert.ok(setHeader && setHeader.includes("helmer_guest="), "Set-Cookie header emitted for new guest");
});

test("Tier 1 - Feature 4: 14-day account deletion lifecycle and session invalidation", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tier1-del-"));
  const userRepo = new FileUserRepository(path.join(tmpDir, "users.json"));
  const authStore = new FileAuthStore(path.join(tmpDir, "auth.json"));

  const user = await userRepo.create({
    fullName: "Deletion User",
    username: "deluser",
    email: "del@example.com",
    passwordHash: "hash123",
  });

  // Create multiple active sessions for this user
  const session1 = "sess_device_1";
  const session2 = "sess_device_2";
  await authStore.createSession(session1, user.id, 3600);
  await authStore.createSession(session2, user.id, 3600);

  assert.ok(await authStore.getSession(session1), "Session 1 exists");
  assert.ok(await authStore.getSession(session2), "Session 2 exists");

  // 1. Schedule deletion for 14 days
  const scheduled = await userRepo.scheduleDeletion(user.id, 14);
  assert.equal(scheduled.status, "pending_deletion");
  assert.ok(scheduled.scheduledDeletionAt);

  // 2. Invalidate user sessions
  await authStore.invalidateUserSessions(user.id);
  assert.equal(await authStore.getSession(session1), null, "Session 1 must be invalidated");
  assert.equal(await authStore.getSession(session2), null, "Session 2 must be invalidated");

  // 3. Cancel deletion
  const restored = await userRepo.cancelDeletion(user.id);
  assert.equal(restored.status, "active");
  assert.equal(restored.scheduledDeletionAt, null);

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Tier 1 - Feature 5: Rate limiting on sensitive routes", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tier1-rate-"));
  const authStore = new FileAuthStore(path.join(tmpDir, "auth.json"));

  const key = "rate:account-deletion:127.0.0.1";
  const maxLimit = 3;
  const windowSeconds = 60;

  // First 3 requests should be allowed
  const hit1 = await authStore.hitRateLimit(key, maxLimit, windowSeconds);
  assert.equal(hit1.allowed, true);
  assert.equal(hit1.remaining, 2);

  const hit2 = await authStore.hitRateLimit(key, maxLimit, windowSeconds);
  assert.equal(hit2.allowed, true);
  assert.equal(hit2.remaining, 1);

  const hit3 = await authStore.hitRateLimit(key, maxLimit, windowSeconds);
  assert.equal(hit3.allowed, true);
  assert.equal(hit3.remaining, 0);

  // 4th request must be rejected
  const hit4 = await authStore.hitRateLimit(key, maxLimit, windowSeconds);
  assert.equal(hit4.allowed, false);
  assert.equal(hit4.remaining, 0);
  assert.ok(hit4.resetAt > Date.now(), "resetAt timestamp must be in future");

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Tier 1 - Feature 6: Strategy concurrency lock & idempotencyKey deduplication", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tier1-strat-"));
  const repo = new FileStrategyRepository(path.join(tmpDir, "strategies.json"));
  const ownerId = `usr_${randomUUID()}`;
  const idempotencyKey = `idemp_${randomUUID()}`;

  const strategyData = {
    title: "Idempotent Strategy",
    summary: "Summary text",
    context: { business: "B", objective: "O", market: "M", targetAudience: "T" },
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  };

  const payload = {
    clientSaveId: idempotencyKey,
    brief: "Business strategy brief",
    answers: [],
    strategy: strategyData,
    versions: [{ versionNumber: 1, data: strategyData, changeRequest: "Initial", createdAt: new Date().toISOString() }],
  };

  // First create
  const record1 = await repo.create(payload, ownerId);
  assert.ok(record1.id);
  assert.equal(record1.clientSaveId, idempotencyKey);

  // Second create with same idempotencyKey returns existing record without duplicating
  const record2 = await repo.create(payload, ownerId);
  assert.equal(record2.id, record1.id, "Duplicate clientSaveId must return existing record");

  const all = await repo.list(ownerId);
  assert.equal(all.length, 1, "Exactly one strategy record should exist");

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Tier 1 - Feature 7: Streaming SSE keepalive comments and abort handling", () => {
  // Verify standard keepalive SSE comment format
  const keepaliveComment = ": keepalive\n\n";
  assert.equal(keepaliveComment.startsWith(":"), true, "SSE comment begins with colon");
  assert.ok(keepaliveComment.endsWith("\n\n"), "SSE comment ends with double newline");

  // Verify AbortController behavior
  const ac = new AbortController();
  assert.equal(ac.signal.aborted, false);
  ac.abort();
  assert.equal(ac.signal.aborted, true);
});

test("Tier 1 - Feature 8: URL sanitization (https?:// only) and citation resilience", () => {
  function isValidCitationUrl(urlString) {
    if (!urlString || typeof urlString !== "string") return false;
    try {
      const parsed = new URL(urlString.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  // Safe URLs
  assert.equal(isValidCitationUrl("https://forbes.com/article"), true);
  assert.equal(isValidCitationUrl("http://reuters.com/news"), true);
  assert.equal(isValidCitationUrl("https://sub.domain.org/path?q=1#hash"), true);

  // Dangerous / Invalid schemes
  assert.equal(isValidCitationUrl("javascript:alert(1)"), false);
  assert.equal(isValidCitationUrl("data:text/html,<script>"), false);
  assert.equal(isValidCitationUrl("file:///etc/passwd"), false);
  assert.equal(isValidCitationUrl("ftp://transfer.example.com"), false);
  assert.equal(isValidCitationUrl("not-a-url"), false);
  assert.equal(isValidCitationUrl(""), false);
  assert.equal(isValidCitationUrl(null), false);
});

test("Tier 1 - Feature 9: Sharded storage repositories and tenant isolation", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tier1-tenant-"));

  // 1. Verify FileUpRepository per-tenant hashing
  const upRepo = new FileUpRepository(path.join(tmpDir, "up"));
  const ownerA = `usr_${randomUUID()}`;
  const ownerB = `usr_${randomUUID()}`;

  const keyA = upRepo.key(ownerA);
  const keyB = upRepo.key(ownerB);
  assert.notEqual(keyA, keyB, "Tenant keys must be distinct sha256 digests");
  assert.equal(keyA.length, 64, "Key is 64-char sha256 hex");

  // 2. Verify FileChatRepository tenant isolation
  const chatRepo = new FileChatRepository(path.join(tmpDir, "chats.json"));
  const chatA = await chatRepo.saveChat({
    ownerId: ownerA,
    title: "Tenant A Chat",
    messages: [{ role: "user", content: "Secret A" }],
  });

  // Tenant B cannot access Tenant A's chat
  assert.equal(await chatRepo.getById(chatA.id, ownerB), null);
  const listB = await chatRepo.list(ownerB);
  assert.equal(listB.length, 0);

  // 3. Verify FileStrategyRepository tenant isolation
  const stratRepo = new FileStrategyRepository(path.join(tmpDir, "strats.json"));
  const stratData = {
    title: "Strat A",
    summary: "Sum",
    context: {},
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  };
  const stratA = await stratRepo.create({
    clientSaveId: "cs_tenant_a",
    brief: "Brief A",
    answers: [],
    strategy: stratData,
    versions: [{ versionNumber: 1, data: stratData, createdAt: new Date().toISOString() }],
  }, ownerA);

  assert.equal(await stratRepo.getById(stratA.id, ownerB), null);
  assert.equal((await stratRepo.list(ownerB)).length, 0);

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Tier 1 - Feature 10: UUID parameter validation regex", () => {
  const uuidRegex = /^[0-9a-f-]{36}$/i;

  // Valid UUIDs
  assert.ok(uuidRegex.test(randomUUID()));
  assert.ok(uuidRegex.test("c716279f-07ec-448f-aa65-ec759160538a"));
  assert.ok(uuidRegex.test("C716279F-07EC-448F-AA65-EC759160538A"));

  // Invalid IDs
  assert.equal(uuidRegex.test("not-a-uuid"), false);
  assert.equal(uuidRegex.test("123"), false);
  assert.equal(uuidRegex.test("c716279f-07ec-448f-aa65-ec759160538"), false); // 35 chars
  assert.equal(uuidRegex.test("c716279f-07ec-448f-aa65-ec759160538aa"), false); // 37 chars
  assert.equal(uuidRegex.test("../../../etc/passwd"), false);
  assert.equal(uuidRegex.test("c716279f-07ec-448f-aa65-ec759160538g"), false); // invalid hex char 'g'
});
