import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import express from "express";
import { hashOpaqueToken, hashPassword, verifyPassword } from "../src/auth/password.js";
import { FileAuthStore } from "../src/auth/auth-store.js";
import { SignupSchema, normalizeEmail, normalizeUsername } from "../src/auth/validation.js";
import { createIdentityMiddleware, requireAuth } from "../src/http/auth-middleware.js";
import { guestSession } from "../src/http/session.js";
import { authErrorHandler, createAuthRouter } from "../src/http/auth-router.js";
import { migrateAuthUserStore } from "../src/repositories/auth-store-migrations.js";
import { FileUserRepository } from "../src/repositories/file-user-repository.js";

test("auth normalization, validation, and Argon2id hashing", async () => {
  assert.equal(normalizeUsername("  Market.Lead_1 "), "market.lead_1");
  assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
  assert.equal(SignupSchema.safeParse({ fullName: "Test User", username: "ok_user", email: "a@b.co", password: "strongpass1" }).success, true);
  assert.equal(SignupSchema.safeParse({ fullName: "Test User", username: "admin", email: "a@b.co", password: "strongpass1" }).success, false);
  assert.equal(SignupSchema.safeParse({ fullName: "Test User", username: ".leading", email: "a@b.co", password: "strongpass1" }).success, false);
  assert.equal(SignupSchema.safeParse({ fullName: "Test User", username: "double..dot", email: "a@b.co", password: "strongpass1" }).success, false);
  const hash = await hashPassword("strongpass1");
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(hash, "strongpass1"), true);
  assert.equal(await verifyPassword(hash, "wrongpass1"), false);
});

test("user store migration and uniqueness are deterministic", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-users-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  assert.deepEqual(migrateAuthUserStore([]), { schemaVersion: 3, users: [] });
  assert.deepEqual(
    migrateAuthUserStore({ schemaVersion: 1, users: [{ id: "legacy" }] }).users[0].settings,
    {
      personalIntelligence: false,
      brandName: "",
      industry: "",
      targetAudience: "",
      primaryMarket: "",
      tone: "professional",
      customInstructions: "",
      memories: [],
      autoContext: true,
      strategyPersonalization: true,
      defaultMode: "build",
      language: "az",
    },
  );
  const repository = new FileUserRepository(path.join(directory, "users.json"));
  const passwordHash = await hashPassword("strongpass1");
  await repository.create({ fullName: "Test User", username: "Test.User", email: "TEST@example.com", passwordHash });
  await assert.rejects(
    repository.create({ fullName: "Other", username: "test.user", email: "other@example.com", passwordHash }),
    (error) => error.code === "USER_CONFLICT" && error.field === "username",
  );
  await assert.rejects(
    repository.create({ fullName: "Other", username: "other", email: "test@EXAMPLE.com", passwordHash }),
    (error) => error.code === "USER_CONFLICT" && error.field === "email",
  );
});

test("guest session creates a stable anonymous workspace owner", async (t) => {
  const app = express();
  app.use(guestSession);
  app.get("/workspace", (req, res) => res.json({ ownerId: req.ownerId }));
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const first = await fetch(`${base}/workspace`);
  assert.equal(first.status, 200);
  const firstOwner = (await first.json()).ownerId;
  assert.match(firstOwner, /^guest_[0-9a-f-]{36}$/i);
  const cookie = first.headers.get("set-cookie").split(";")[0];

  const returning = await fetch(`${base}/workspace`, { headers: { Cookie: cookie } });
  assert.equal((await returning.json()).ownerId, firstOwner);

  // Forged unsigned cookie must be rejected and replaced with a new generated ID
  const forged = await fetch(`${base}/workspace`, { headers: { Cookie: "helmer_guest=guest_11111111-2222-3333-4444-555555555555" } });
  assert.notEqual((await forged.json()).ownerId, "guest_11111111-2222-3333-4444-555555555555");
});

test("signup, session, login, reset, and single-use reset token work end to end", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-auth-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const users = new FileUserRepository(path.join(directory, "users.json"));
  const store = new FileAuthStore(path.join(directory, "sessions.json"));
  const sent = [];
  const verificationMessages = [];
  const emailService = {
    sendPasswordResetEmail: async (message) => sent.push(message),
    sendEmailVerificationCode: async (message) => verificationMessages.push(message),
  };
  const app = express();
  app.use(express.json());
  app.use(createIdentityMiddleware({ authStore: store, userRepository: users }));
  app.use("/api/auth", createAuthRouter({
    userRepository: users,
    authStore: store,
    emailService,
    strategyRepository: { claimOwner: async () => 0 },
    appUrl: "http://localhost",
  }));
  app.get("/protected", requireAuth, (req, res) => res.json({ ownerId: req.ownerId }));
  app.use(authErrorHandler);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const blocked = await fetch(`${base}/protected`);
  assert.equal(blocked.status, 401);

  const invalidSignup = await fetch(`${base}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "M", username: "x", email: "invalid", password: "weak" }),
  });
  assert.equal(invalidSignup.status, 400);

  const signup = await fetch(`${base}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Market Lead", username: "market.lead", email: "lead@example.com", password: "strongpass1" }),
  });
  assert.equal(signup.status, 201);
  const created = await signup.json();
  assert.equal(created.verificationRequired, true);
  assert.equal(created.email, "lead@example.com");
  assert.equal(verificationMessages.length, 1);

  const verification = await fetch(`${base}/api/auth/email-verification/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "lead@example.com", code: verificationMessages[0].code }),
  });
  assert.equal(verification.status, 200);
  const cookie = verification.headers.get("set-cookie").split(";")[0];
  const verified = await verification.json();
  assert.equal(verified.user.username, "market.lead");
  assert.equal(verified.user.settings.personalIntelligence, false);
  assert.equal("passwordHash" in verified.user, false);

  const enabledSettings = await fetch(`${base}/api/auth/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ personalIntelligence: true, defaultMode: "ask" }),
  });
  assert.equal(enabledSettings.status, 200);
  assert.equal((await enabledSettings.json()).user.settings.personalIntelligence, true);
  const refreshedMe = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  const meJson = await refreshedMe.json();
  assert.equal(meJson.user.settings.personalIntelligence, true);
  assert.equal(meJson.user.settings.defaultMode, "ask");

  const importRes = await fetch(`${base}/api/auth/settings/import-memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      brandName: "Helmer",
      industry: "B2B SaaS",
      primaryMarket: "Azərbaycan",
      targetAudience: "Startaplar və marketoloqlar",
      tone: "creative",
      customInstructions: "Qısa və icra yönümlü ol.",
      memories: [
        { text: "Biz yalnız B2B şirkətlərlə işləyirik.", category: "business" },
        { text: "TV və radio reklamlarından istifadə etmirik.", category: "constraint" },
      ],
      mergeMode: "merge",
      enablePersonalIntelligence: true,
    }),
  });
  assert.equal(importRes.status, 200);
  const importJson = await importRes.json();
  assert.equal(importJson.ok, true);
  assert.equal(importJson.importedCount, 2);
  assert.equal(importJson.user.settings.brandName, "Helmer");
  assert.equal(importJson.user.settings.tone, "creative");
  assert.equal(importJson.user.settings.memories.length, 2);
  assert.equal(importJson.user.settings.personalIntelligence, true);

  const unauthenticatedSettings = await fetch(`${base}/api/auth/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personalIntelligence: true }),
  });
  assert.equal(unauthenticatedSettings.status, 401);

  const duplicateSignup = await fetch(`${base}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Other", username: "MARKET.LEAD", email: "other@example.com", password: "strongpass1" }),
  });
  assert.equal(duplicateSignup.status, 409);

  const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.email, "lead@example.com");
  const protectedResponse = await fetch(`${base}/protected`, { headers: { Cookie: cookie } });
  assert.equal(protectedResponse.status, 200);

  const wrongLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "market.lead", password: "incorrect1" }),
  });
  assert.equal(wrongLogin.status, 401);
  assert.equal((await wrongLogin.json()).error, "E-poçt/istifadəçi adı və ya şifrə yanlışdır.");

  const usernameLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "MARKET.LEAD", password: "strongpass1" }),
  });
  assert.equal(usernameLogin.status, 200);
  const usernameCookie = usernameLogin.headers.get("set-cookie").split(";")[0];
  const logout = await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: usernameCookie },
    body: "{}",
  });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: usernameCookie } })).status, 401);

  const emailLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "LEAD@example.com", password: "strongpass1" }),
  });
  assert.equal(emailLogin.status, 200);
  const otherSessionCookie = emailLogin.headers.get("set-cookie").split(";")[0];

  const wrongChange = await fetch(`${base}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ currentPassword: "wrongpass1", newPassword: "changedpass2" }),
  });
  assert.equal(wrongChange.status, 400);
  const changed = await fetch(`${base}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ currentPassword: "strongpass1", newPassword: "changedpass2" }),
  });
  assert.equal(changed.status, 200);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: otherSessionCookie } })).status, 401);
  const oldPasswordLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "market.lead", password: "strongpass1" }),
  });
  assert.equal(oldPasswordLogin.status, 401);

  const changedPasswordLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "lead@example.com", password: "changedpass2" }),
  });
  assert.equal(changedPasswordLogin.status, 200);
  const changedPasswordCookie = changedPasswordLogin.headers.get("set-cookie").split(";")[0];

  const unknownForgot = await fetch(`${base}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "missing@example.com" }),
  });
  const unknownForgotBody = await unknownForgot.json();
  assert.equal(unknownForgot.status, 200);

  const expiredRawToken = "expired-reset-token-value-1234567890";
  await store.createResetToken(hashOpaqueToken(expiredRawToken), verified.user.id, -1);
  const expiredReset = await fetch(`${base}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: expiredRawToken, password: "newstrongpass2" }),
  });
  assert.equal(expiredReset.status, 400);

  const forgot = await fetch(`${base}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "lead@example.com" }),
  });
  assert.equal(forgot.status, 200);
  assert.equal((await forgot.json()).message, unknownForgotBody.message);
  assert.equal(sent.length, 1);
  const token = new URL(sent[0].resetUrl).searchParams.get("token");
  assert.ok(token);

  const reset = await fetch(`${base}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password: "newstrongpass2" }),
  });
  assert.equal(reset.status, 200);
  const reused = await fetch(`${base}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password: "anotherpass3" }),
  });
  assert.equal(reused.status, 400);
  const expiredSession = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(expiredSession.status, 401);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: changedPasswordCookie } })).status, 401);

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "LEAD@example.com", password: "newstrongpass2" }),
  });
  assert.equal(login.status, 200);

  const configRes = await fetch(`${base}/api/auth/config`);
  assert.equal(configRes.status, 200);
  const configData = await configRes.json();
  assert.ok("googleClientId" in configData);

  const missingGoogleCred = await fetch(`${base}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(missingGoogleCred.status, 400);

  const invalidGoogleCred = await fetch(`${base}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: "invalid.jwt.token" }),
  });
  assert.ok([401, 503].includes(invalidGoogleCred.status));
});
