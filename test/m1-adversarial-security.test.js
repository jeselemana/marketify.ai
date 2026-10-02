import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import express from "express";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

import {
  signGuestId,
  verifyGuestCookie,
  resolveGuestSecret,
  isValidGuestId,
  parseCookies,
  guestSession,
} from "../src/http/session.js";
import { FileAuthStore } from "../src/auth/auth-store.js";
import { FileUserRepository } from "../src/repositories/file-user-repository.js";
import { hashOpaqueToken, hashPassword } from "../src/auth/password.js";
import {
  createIdentityMiddleware,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "../src/http/auth-middleware.js";
import { authErrorHandler, createAuthRouter } from "../src/http/auth-router.js";
import { createTelemetryClientRouter } from "../src/http/telemetry-router.js";
import { TelemetryService } from "../src/services/telemetry/telemetry-service.js";
import { FileTelemetryRepository } from "../src/repositories/file-telemetry-repository.js";

// ============================================================================
// SUITE 1: HMAC GUEST COOKIE ADVERSARIAL & CRYPTOGRAPHIC STRESS TEST
// ============================================================================

test("SUITE 1.1: HMAC guest cookie forgery, signature tampering, bit flipping, and replaying", async () => {
  const originalSecret = process.env.SESSION_SECRET;
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.SESSION_SECRET = "stress_test_secret_key_alpha_1234567890";
    delete process.env.AUTH_SECRET;

    const guestId = `guest_${randomUUID()}`;
    const validCookie = signGuestId(guestId);
    assert.equal(verifyGuestCookie(validCookie), guestId, "Valid cookie must verify successfully");

    const dotIndex = validCookie.indexOf(".");
    const signature = validCookie.slice(dotIndex + 1);

    // 1. Forgery with arbitrary signatures
    assert.equal(verifyGuestCookie(`${guestId}.` ), null, "Empty signature must fail");
    assert.equal(verifyGuestCookie(`${guestId}.${"0".repeat(32)}`), null, "All-zero signature must fail");
    assert.equal(verifyGuestCookie(`${guestId}.${"f".repeat(32)}`), null, "All-f signature must fail");
    assert.equal(verifyGuestCookie(`${guestId}.${randomBytes(16).toString("hex")}`), null, "Random signature must fail");

    // 2. Forgery with weak/known secrets
    const forgedWithSecret = createHmac("sha256", "secret").update(guestId).digest("hex").slice(0, 32);
    assert.equal(verifyGuestCookie(`${guestId}.${forgedWithSecret}`), null, "Signature with key 'secret' must fail");

    const forgedWithEmpty = createHmac("sha256", "").update(guestId).digest("hex").slice(0, 32);
    assert.equal(verifyGuestCookie(`${guestId}.${forgedWithEmpty}`), null, "Signature with empty key must fail");

    // 3. Signature Tampering - mutating single character across all positions
    for (let i = 0; i < signature.length; i++) {
      const origChar = signature[i];
      const replacementChar = origChar === "a" ? "b" : "a";
      const tamperedSig = signature.slice(0, i) + replacementChar + signature.slice(i + 1);
      assert.equal(
        verifyGuestCookie(`${guestId}.${tamperedSig}`),
        null,
        `Tampered signature at position ${i} must fail verification`,
      );
    }

    // 4. Bit Flipping Attack across signature characters
    for (let i = 0; i < signature.length; i++) {
      const charCode = signature.charCodeAt(i);
      for (let bit = 0; bit < 7; bit++) {
        const flipped = String.fromCharCode(charCode ^ (1 << bit));
        if (flipped === signature[i]) continue;
        const bitFlippedSig = signature.slice(0, i) + flipped + signature.slice(i + 1);
        assert.equal(
          verifyGuestCookie(`${guestId}.${bitFlippedSig}`),
          null,
          `Bit flip at position ${i} bit ${bit} must fail`,
        );
      }
    }

    // 5. Bit Flipping Attack across guest ID
    for (let i = 6; i < guestId.length; i++) {
      const charCode = guestId.charCodeAt(i);
      if (guestId[i] === "-") continue;
      const flipped = String.fromCharCode(charCode ^ 1);
      const tamperedGuestId = guestId.slice(0, i) + flipped + guestId.slice(i + 1);
      assert.equal(
        verifyGuestCookie(`${tamperedGuestId}.${signature}`),
        null,
        `Tampered guest ID at char ${i} with original signature must fail`,
      );
    }

    // 6. Signature Length Tampering (truncation & padding)
    assert.equal(verifyGuestCookie(`${guestId}.${signature.slice(0, 31)}`), null, "Truncated 31-char signature must fail");
    assert.equal(verifyGuestCookie(`${guestId}.${signature.slice(0, 16)}`), null, "Truncated 16-char signature must fail");
    assert.equal(verifyGuestCookie(`${guestId}.${signature}0`), null, "Extended 33-char signature must fail");
    assert.equal(verifyGuestCookie(`${guestId}.${signature}${signature}`), null, "Doubled 64-char signature must fail");

    // 7. Signature Case Sensitivity (uppercase hex HMAC)
    const upperSig = signature.toUpperCase();
    if (upperSig !== signature) {
      assert.equal(verifyGuestCookie(`${guestId}.${upperSig}`), null, "Uppercase hex signature must fail verification");
    }

    // 8. Replay Attack: attach valid signature of guestA to guestB
    const otherGuestId = `guest_${randomUUID()}`;
    assert.equal(
      verifyGuestCookie(`${otherGuestId}.${signature}`),
      null,
      "Replaying signature from guestA on guestB must fail",
    );

    // 9. Malformed / Path Traversal / Injection Inputs
    assert.equal(verifyGuestCookie(null), null);
    assert.equal(verifyGuestCookie(undefined), null);
    assert.equal(verifyGuestCookie(""), null);
    assert.equal(verifyGuestCookie(12345), null);
    assert.equal(verifyGuestCookie({}), null);
    assert.equal(verifyGuestCookie(`${guestId}`), null, "Missing dot must fail");
    assert.equal(verifyGuestCookie(`.${signature}`), null, "Empty guestId must fail");
    assert.equal(verifyGuestCookie(`${guestId}.${signature}.extra`), null, "Multiple dots must fail");
    assert.equal(verifyGuestCookie(`guest_admin.${signature}`), null, "Non-UUID guest format must fail");
    assert.equal(verifyGuestCookie(`guest_../../etc/passwd.${signature}`), null, "Path traversal in guest ID must fail");
    assert.equal(verifyGuestCookie(`guest_' OR 1=1--.${signature}`), null, "SQLi in guest ID must fail");
    assert.equal(verifyGuestCookie(`guest_<script>alert(1)</script>.${signature}`), null, "XSS in guest ID must fail");
  } finally {
    process.env.SESSION_SECRET = originalSecret;
    if (originalAuthSecret) process.env.AUTH_SECRET = originalAuthSecret;
    else delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("SUITE 1.2: Dynamic secret resolution at runtime without server restart", async () => {
  const originalSecret = process.env.SESSION_SECRET;
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    delete process.env.AUTH_SECRET;

    // Phase 1: Set Secret Alpha
    process.env.SESSION_SECRET = "dynamic_secret_alpha_111111111";
    const guest1 = `guest_${randomUUID()}`;
    const cookie1 = signGuestId(guest1);
    assert.equal(verifyGuestCookie(cookie1), guest1, "Cookie signed with Secret Alpha verifies with Secret Alpha");

    // Phase 2: Rotate secret to Beta dynamically in same process
    process.env.SESSION_SECRET = "dynamic_secret_beta_222222222";

    // Immediate effect: cookie signed with Alpha MUST FAIL without server restart
    assert.equal(
      verifyGuestCookie(cookie1),
      null,
      "Old cookie signed with Secret Alpha must immediately fail after secret rotation to Beta",
    );

    // New cookies signed with Beta MUST SUCCEED
    const guest2 = `guest_${randomUUID()}`;
    const cookie2 = signGuestId(guest2);
    assert.equal(
      verifyGuestCookie(cookie2),
      guest2,
      "New cookie signed with Secret Beta must verify with Secret Beta",
    );

    // Phase 3: Rollback to Alpha
    process.env.SESSION_SECRET = "dynamic_secret_alpha_111111111";
    assert.equal(
      verifyGuestCookie(cookie1),
      guest1,
      "Cookie 1 becomes valid again when secret is restored to Alpha",
    );
    assert.equal(
      verifyGuestCookie(cookie2),
      null,
      "Cookie 2 becomes invalid when secret is restored to Alpha",
    );

    // Phase 4: Production enforcement: unset secret throws fatal error in production mode
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    delete process.env.AUTH_SECRET;
    assert.throws(
      () => resolveGuestSecret(),
      /Fatal: SESSION_SECRET or AUTH_SECRET environment variable is required in production mode/,
      "Must throw in production if secret is missing",
    );

    // Phase 5: Fallback in development mode
    process.env.NODE_ENV = "development";
    const fallbackSecret = resolveGuestSecret();
    assert.equal(
      fallbackSecret,
      "helmer_guest_hmac_secret_fallback_key",
      "Must fall back to default key in development mode",
    );
  } finally {
    process.env.SESSION_SECRET = originalSecret;
    if (originalAuthSecret) process.env.AUTH_SECRET = originalAuthSecret;
    else delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = originalNodeEnv;
  }
});

// ============================================================================
// SUITE 2: ACCOUNT DELETION & SESSION INVALIDATION STRESS TEST
// ============================================================================

test("SUITE 2.1: Multi-device session revocation on POST /account/delete-request", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m1-del-sessions-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const users = new FileUserRepository(path.join(tmpDir, "users.json"));
  const authStore = new FileAuthStore(path.join(tmpDir, "sessions.json"));

  // 1. Create User Alice and User Bob
  const passwordHash = await hashPassword("ValidPassword123!");
  const alice = await users.create({
    fullName: "Alice MultiDevice",
    username: "alice_multidevice",
    email: "alice.multi@example.com",
    passwordHash,
  });

  const bob = await users.create({
    fullName: "Bob SingleDevice",
    username: "bob_singledevice",
    email: "bob.single@example.com",
    passwordHash,
  });

  // 2. Simulate 3 distinct devices for Alice and 1 device for Bob
  const tokenAliceDevice1 = createSessionToken();
  const tokenAliceDevice2 = createSessionToken();
  const tokenAliceDevice3 = createSessionToken();
  const tokenBobDevice1 = createSessionToken();

  const sessionAliceD1 = hashOpaqueToken(tokenAliceDevice1);
  const sessionAliceD2 = hashOpaqueToken(tokenAliceDevice2);
  const sessionAliceD3 = hashOpaqueToken(tokenAliceDevice3);
  const sessionBobD1 = hashOpaqueToken(tokenBobDevice1);

  await authStore.createSession(sessionAliceD1, alice.id, SESSION_TTL_SECONDS);
  await authStore.createSession(sessionAliceD2, alice.id, SESSION_TTL_SECONDS);
  await authStore.createSession(sessionAliceD3, alice.id, SESSION_TTL_SECONDS);
  await authStore.createSession(sessionBobD1, bob.id, SESSION_TTL_SECONDS);

  // Verify all 4 sessions exist before deletion
  assert.ok(await authStore.getSession(sessionAliceD1), "Alice D1 session must be active");
  assert.ok(await authStore.getSession(sessionAliceD2), "Alice D2 session must be active");
  assert.ok(await authStore.getSession(sessionAliceD3), "Alice D3 session must be active");
  assert.ok(await authStore.getSession(sessionBobD1), "Bob D1 session must be active");

  // 3. Set up Express application
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use(createIdentityMiddleware({ authStore, userRepository: users }));
  app.use(
    "/api/auth",
    createAuthRouter({
      userRepository: users,
      authStore,
      emailService: { sendEmailVerificationCode: async () => {}, sendPasswordResetEmail: async () => {} },
      appUrl: "http://127.0.0.1:3000",
    }),
  );
  app.use(authErrorHandler);

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // 4a. Alice attempts POST /api/auth/account/delete-request without password (MUST fail with 403 REAUTH_REQUIRED)
  const unauthDelRes = await fetch(`${baseUrl}/api/auth/account/delete-request`, {
    method: "POST",
    headers: {
      Cookie: `${SESSION_COOKIE}=${encodeURIComponent(tokenAliceDevice1)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  assert.equal(unauthDelRes.status, 403, "Delete request without password must return 403 REAUTH_REQUIRED");
  assert.equal((await unauthDelRes.json()).code, "REAUTH_REQUIRED");

  // 4b. Alice issues POST /api/auth/account/delete-request from Device 1 with valid password
  const delRes = await fetch(`${baseUrl}/api/auth/account/delete-request`, {
    method: "POST",
    headers: {
      Cookie: `${SESSION_COOKIE}=${encodeURIComponent(tokenAliceDevice1)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ currentPassword: "ValidPassword123!" }),
  });

  assert.equal(delRes.status, 200, "Delete request with valid password must return 200 OK");
  const delBody = await delRes.json();
  assert.equal(delBody.success, true);
  assert.ok(delBody.scheduledDeletionAt, "Must include scheduledDeletionAt date");

  // Check Set-Cookie cleared session
  const setCookie = delRes.headers.get("set-cookie") || "";
  assert.match(setCookie, new RegExp(`${SESSION_COOKIE}=;`), "Must clear session cookie on responding device");

  // 5. EMPIRICAL VERIFICATION: Check authStore directly
  // All 3 sessions of Alice MUST be invalidated
  assert.equal(
    await authStore.getSession(sessionAliceD1),
    null,
    "Alice Device 1 session must be revoked in authStore",
  );
  assert.equal(
    await authStore.getSession(sessionAliceD2),
    null,
    "Alice Device 2 session must be revoked in authStore",
  );
  assert.equal(
    await authStore.getSession(sessionAliceD3),
    null,
    "Alice Device 3 session must be revoked in authStore",
  );

  // Bob's session MUST be completely untouched
  const bobSession = await authStore.getSession(sessionBobD1);
  assert.ok(bobSession, "Bob session must remain completely active");
  assert.equal(bobSession.userId, bob.id);

  // 6. HTTP VERIFICATION: Verify subsequent requests with revoked tokens fail
  // Alice Device 2 tries to access /api/auth/me -> 401 AUTH_REQUIRED
  const d2Res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(tokenAliceDevice2)}` },
  });
  assert.equal(d2Res.status, 401, "Device 2 must be rejected with 401");
  assert.equal((await d2Res.json()).code, "AUTH_REQUIRED");

  // Alice Device 3 tries to access /api/auth/me -> 401 AUTH_REQUIRED
  const d3Res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(tokenAliceDevice3)}` },
  });
  assert.equal(d3Res.status, 401, "Device 3 must be rejected with 401");

  // Bob tries to access /api/auth/me -> 200 OK
  const bobRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(tokenBobDevice1)}` },
  });
  assert.equal(bobRes.status, 200, "Bob must still be authenticated with 200 OK");
  assert.equal((await bobRes.json()).user.id, bob.id);
});

test("SUITE 2.2: purgeExpiredAccounts cascades session cleanup from authStore", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m1-purge-sessions-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const users = new FileUserRepository(path.join(tmpDir, "users.json"));
  const authStore = new FileAuthStore(path.join(tmpDir, "sessions.json"));

  const passwordHash = await hashPassword("ValidPassword123!");

  // User 1: Expired user (deletion scheduled 15 days ago, expired yesterday)
  const expiredUser = await users.create({
    fullName: "Expired User",
    username: "expired_user",
    email: "expired@example.com",
    passwordHash,
  });
  await users.update(
    expiredUser.id,
    {
      status: "pending_deletion",
      deletionRequestedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      scheduledDeletionAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { allowSystemFields: true },
  );

  // User 2: Active user in grace period (deletion scheduled for 10 days in the future)
  const graceUser = await users.create({
    fullName: "Grace User",
    username: "grace_user",
    email: "grace@example.com",
    passwordHash,
  });
  await users.scheduleDeletion(graceUser.id, 10);

  // User 3: Unverified signup created 25 hours ago (> 24h limit)
  const unverifiedExpired = await users.create({
    fullName: "Unverified Expired",
    username: "unverified_expired",
    email: "unverified.exp@example.com",
    passwordHash,
  });
  await users.mutateUsers(state => {
    state.users.find(u => u.id === unverifiedExpired.id).createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    return { store: state };
  });

  // User 4: Unverified signup created 2 hours ago (< 24h limit)
  const unverifiedFresh = await users.create({
    fullName: "Unverified Fresh",
    username: "unverified_fresh",
    email: "unverified.fresh@example.com",
    passwordHash,
  });
  await users.mutateUsers(state => {
    state.users.find(u => u.id === unverifiedFresh.id).createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    return { store: state };
  });

  // Create active sessions in authStore for all 4 users
  const tokenExpired = createSessionToken();
  const tokenGrace = createSessionToken();
  const tokenUnverifiedExp = createSessionToken();
  const tokenUnverifiedFresh = createSessionToken();

  const sessExpired = hashOpaqueToken(tokenExpired);
  const sessGrace = hashOpaqueToken(tokenGrace);
  const sessUnverifiedExp = hashOpaqueToken(tokenUnverifiedExp);
  const sessUnverifiedFresh = hashOpaqueToken(tokenUnverifiedFresh);

  await authStore.createSession(sessExpired, expiredUser.id, SESSION_TTL_SECONDS);
  await authStore.createSession(sessGrace, graceUser.id, SESSION_TTL_SECONDS);
  await authStore.createSession(sessUnverifiedExp, unverifiedExpired.id, SESSION_TTL_SECONDS);
  await authStore.createSession(sessUnverifiedFresh, unverifiedFresh.id, SESSION_TTL_SECONDS);

  // Pre-condition check
  assert.ok(await authStore.getSession(sessExpired));
  assert.ok(await authStore.getSession(sessGrace));
  assert.ok(await authStore.getSession(sessUnverifiedExp));
  assert.ok(await authStore.getSession(sessUnverifiedFresh));

  // Run purgeExpiredAccounts with authStore passed
  const purgedCount = await users.purgeExpiredAccounts({ authStore });
  assert.equal(purgedCount, 2, "Must purge exactly 2 accounts (expired user + unverified > 24h)");

  // Verify expired user was purged from users and its session removed from authStore
  assert.equal(await users.findById(expiredUser.id), null);
  assert.equal(
    await authStore.getSession(sessExpired),
    null,
    "Expired user session must be revoked in authStore after purge",
  );

  // Verify unverified > 24h was purged from users and its session removed from authStore
  assert.equal(await users.findById(unverifiedExpired.id), null);
  assert.equal(
    await authStore.getSession(sessUnverifiedExp),
    null,
    "Unverified expired user session must be revoked in authStore after purge",
  );

  // Verify grace user was NOT purged and session is still active
  assert.ok(await users.findById(graceUser.id));
  assert.ok(await authStore.getSession(sessGrace), "Grace period user session must remain intact");

  // Verify fresh unverified user was NOT purged and session is still active
  assert.ok(await users.findById(unverifiedFresh.id));
  assert.ok(await authStore.getSession(sessUnverifiedFresh), "Fresh unverified user session must remain intact");
});

test("SUITE 2.3: Identity middleware intercepts and invalidates zombie session of expired account", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m1-zombie-session-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const users = new FileUserRepository(path.join(tmpDir, "users.json"));
  const authStore = new FileAuthStore(path.join(tmpDir, "sessions.json"));

  const passwordHash = await hashPassword("ValidPassword123!");
  const zombieUser = await users.create({
    fullName: "Zombie User",
    username: "zombie_user",
    email: "zombie@example.com",
    passwordHash,
  });

  // Manually simulate an expired scheduledDeletionAt on disk before background purge ran
  await users.update(
    zombieUser.id,
    {
      status: "pending_deletion",
      scheduledDeletionAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    },
    { allowSystemFields: true },
  );

  const zombieToken = createSessionToken();
  const zombieSessionId = hashOpaqueToken(zombieToken);
  await authStore.createSession(zombieSessionId, zombieUser.id, SESSION_TTL_SECONDS);

  const app = express();
  app.use(createIdentityMiddleware({ authStore, userRepository: users }));
  app.get("/test-auth", (req, res) => {
    if (!req.user) return res.status(401).json({ code: "AUTH_REQUIRED" });
    return res.json({ ok: true, user: req.user.id });
  });

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${baseUrl}/test-auth`, {
    headers: { Cookie: `${SESSION_COOKIE}=${encodeURIComponent(zombieToken)}` },
  });

  assert.equal(res.status, 401, "Zombie session must be rejected with 401");
  assert.equal(
    await authStore.getSession(zombieSessionId),
    null,
    "Zombie session must be instantly invalidated in authStore by identity middleware",
  );
});

// ============================================================================
// SUITE 3: RATE LIMITING ENFORCEMENT & STRESS TEST
// ============================================================================

test("SUITE 3.1: Rate limiting on POST /account/delete-request (threshold: 5 req / 15 min)", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m1-rate-del-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const users = new FileUserRepository(path.join(tmpDir, "users.json"));
  const authStore = new FileAuthStore(path.join(tmpDir, "sessions.json"));

  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use(createIdentityMiddleware({ authStore, userRepository: users }));
  app.use(
    "/api/auth",
    createAuthRouter({
      userRepository: users,
      authStore,
      emailService: { sendEmailVerificationCode: async () => {}, sendPasswordResetEmail: async () => {} },
      appUrl: "http://127.0.0.1:3000",
    }),
  );
  app.use(authErrorHandler);

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const testIp = "198.51.100.42";

  // Fire 5 unauthenticated requests from testIp -> each allowed by rate limiter (returns 401 AUTH_REQUIRED)
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${baseUrl}/api/auth/account/delete-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": testIp,
      },
    });
    assert.equal(res.status, 401, `Request #${i} should pass rate limit (return 401 auth required)`);
    const remaining = res.headers.get("x-ratelimit-remaining");
    assert.equal(remaining, String(5 - i), `Remaining header on request #${i} must be ${5 - i}`);
  }

  // Request #6 from same testIp MUST return HTTP 429 RATE_LIMITED
  const resExceeded = await fetch(`${baseUrl}/api/auth/account/delete-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": testIp,
    },
  });

  assert.equal(resExceeded.status, 429, "Request #6 exceeding 5 limit must return HTTP 429");
  const exceededBody = await resExceeded.json();
  assert.equal(exceededBody.code, "RATE_LIMITED");
  assert.ok(exceededBody.error);
  assert.ok(resExceeded.headers.get("retry-after"), "Must include Retry-After header");
  assert.equal(resExceeded.headers.get("x-ratelimit-remaining"), "0");

  // Request from DIFFERENT IP must NOT be blocked
  const resDifferentIp = await fetch(`${baseUrl}/api/auth/account/delete-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "198.51.100.99",
    },
  });
  assert.equal(resDifferentIp.status, 401, "Different IP must not be throttled (returns 401)");
  assert.equal(resDifferentIp.headers.get("x-ratelimit-remaining"), "4");
});

test("SUITE 3.2: Rate limiting on PATCH /settings (threshold: 30 req / 15 min)", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m1-rate-settings-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const users = new FileUserRepository(path.join(tmpDir, "users.json"));
  const authStore = new FileAuthStore(path.join(tmpDir, "sessions.json"));

  const passwordHash = await hashPassword("ValidPassword123!");
  const user = await users.create({
    fullName: "Settings Tester",
    username: "settings_tester",
    email: "settings@example.com",
    passwordHash,
  });

  const sessionToken = createSessionToken();
  const sessionId = hashOpaqueToken(sessionToken);
  await authStore.createSession(sessionId, user.id, SESSION_TTL_SECONDS);

  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use(createIdentityMiddleware({ authStore, userRepository: users }));
  app.use(
    "/api/auth",
    createAuthRouter({
      userRepository: users,
      authStore,
      emailService: { sendEmailVerificationCode: async () => {}, sendPasswordResetEmail: async () => {} },
      appUrl: "http://127.0.0.1:3000",
    }),
  );
  app.use(authErrorHandler);

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const clientIp = "192.0.2.55";
  const cookieHeader = `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`;

  // Fire 30 PATCH /settings requests -> all should return 200 OK
  for (let i = 1; i <= 30; i++) {
    const res = await fetch(`${baseUrl}/api/auth/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        "X-Forwarded-For": clientIp,
      },
      body: JSON.stringify({ tone: "direct" }),
    });
    assert.equal(res.status, 200, `Settings patch #${i} must succeed with 200`);
    const remaining = res.headers.get("x-ratelimit-remaining");
    assert.equal(remaining, String(30 - i), `Remaining on request #${i} must be ${30 - i}`);
  }

  // Request #31 MUST return HTTP 429
  const resThrottled = await fetch(`${baseUrl}/api/auth/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      "X-Forwarded-For": clientIp,
    },
    body: JSON.stringify({ tone: "direct" }),
  });

  assert.equal(resThrottled.status, 429, "Request #31 exceeding 30 limit must return 429");
  const throttledBody = await resThrottled.json();
  assert.equal(throttledBody.code, "RATE_LIMITED");
  assert.ok(resThrottled.headers.get("retry-after"));
  assert.equal(resThrottled.headers.get("x-ratelimit-remaining"), "0");
});

test("SUITE 3.3: Rate limiting on POST /telemetry/event (threshold: 120 req / 1 min)", async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-m1-rate-telem-"));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));

  const telemRepo = new FileTelemetryRepository(path.join(tmpDir, "telemetry.json"), null, { mirrorToR2: false });
  const telemService = new TelemetryService(telemRepo);

  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use("/api/telemetry", createTelemetryClientRouter(telemService));

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const clientIp = "198.18.0.77";
  const payload = JSON.stringify({
    eventType: "export_requested",
    format: "pdf",
    title: "Quarterly Marketing Plan",
  });

  // Fire 120 POST requests from clientIp -> all should succeed with 200
  for (let i = 1; i <= 120; i++) {
    const res = await fetch(`${baseUrl}/api/telemetry/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": clientIp,
      },
      body: payload,
    });
    assert.equal(res.status, 200, `Telemetry event #${i} must succeed with 200`);
    assert.equal(res.headers.get("x-ratelimit-remaining"), String(120 - i));
  }

  // Request #121 MUST return HTTP 429
  const resExceeded = await fetch(`${baseUrl}/api/telemetry/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": clientIp,
    },
    body: payload,
  });

  assert.equal(resExceeded.status, 429, "Telemetry event #121 exceeding 120 limit must return 429");
  const exceededBody = await resExceeded.json();
  assert.equal(exceededBody.code, "RATE_LIMITED");
  assert.ok(exceededBody.retryAfter, "Response must include retryAfter in body");
  assert.ok(resExceeded.headers.get("retry-after"), "Response must include Retry-After header");
  assert.equal(resExceeded.headers.get("x-ratelimit-remaining"), "0");

  // Request from a DIFFERENT IP must NOT be blocked
  const resOtherIp = await fetch(`${baseUrl}/api/telemetry/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "198.18.0.88",
    },
    body: payload,
  });
  assert.equal(resOtherIp.status, 200, "Different IP must not be throttled (returns 200)");
  assert.equal(resOtherIp.headers.get("x-ratelimit-remaining"), "119");
});
