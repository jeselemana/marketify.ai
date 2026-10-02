import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import express from "express";
import { FileAuthStore, RedisAuthStore } from "../src/auth/auth-store.js";
import { SignupSchema } from "../src/auth/validation.js";
import { createIdentityMiddleware } from "../src/http/auth-middleware.js";
import { authErrorHandler, createAuthRouter } from "../src/http/auth-router.js";
import { httpStatusOf, publicErrorMessage } from "../src/http/error-response.js";
import { strategyErrorHandler } from "../src/http/strategy-router.js";
import { FileUserRepository } from "../src/repositories/file-user-repository.js";

async function startAuthApp(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "helmer-auth-v4-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const users = new FileUserRepository(path.join(directory, "users.json"));
  const store = new FileAuthStore(path.join(directory, "sessions.json"));
  const app = express();
  app.use("/api/auth", express.json({ limit: "64kb" }));
  app.use(express.json());
  app.use(createIdentityMiddleware({ authStore: store, userRepository: users }));
  app.use("/api/auth", createAuthRouter({
    userRepository: users,
    authStore: store,
    emailService: { sendPasswordResetEmail: async () => {}, sendEmailVerificationCode: async () => {} },
    appUrl: "http://localhost",
  }));
  app.use(authErrorHandler);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, store };
}

function login(base, identifier) {
  return fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password: "wrongpass1" }),
  });
}

test("v4: whitespace/case/@ variants of one identifier share a login rate-limit bucket", async (t) => {
  const { base } = await startAuthApp(t);
  const variants = ["victim", " victim", "victim ", "VICTIM", "@victim", "  @Victim  "];
  const statuses = [];
  for (let i = 0; i < 13; i += 1) {
    statuses.push((await login(base, variants[i % variants.length])).status);
  }
  assert.deepEqual(statuses.slice(0, 12), Array(12).fill(401));
  assert.equal(statuses[12], 429, "the 13th attempt against the same account must be throttled");
});

test("v4: oversized and malformed auth payloads return 413/400 instead of a 500", async (t) => {
  const { base } = await startAuthApp(t);
  const huge = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "a", password: "x".repeat(70 * 1024) }),
  });
  assert.equal(huge.status, 413);
  assert.equal((await huge.json()).code, "PAYLOAD_TOO_LARGE");

  const malformed = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, "INVALID_JSON");
});

test("v4: forged session cookies are rejected without rewriting the auth store", async (t) => {
  const { base, store } = await startAuthApp(t);
  let writes = 0;
  const originalWriteLocal = store.writeLocal.bind(store);
  store.writeLocal = async (...args) => { writes += 1; return originalWriteLocal(...args); };
  for (let i = 0; i < 5; i += 1) {
    const response = await fetch(`${base}/api/auth/me`, { headers: { Cookie: `helmer_session=forged${i}` } });
    assert.equal(response.status, 401);
  }
  assert.equal(writes, 0);
});

test("v4: 'boss' is reserved so it cannot be claimed as an admin-looking username", () => {
  assert.equal(
    SignupSchema.safeParse({ fullName: "Test User", username: "boss", email: "a@b.co", password: "strongpass1" }).success,
    false,
  );
});

test("v4: Redis rate limit creates the key with its TTL atomically and tolerates corrupt values", async () => {
  const calls = [];
  const values = new Map([["auth:session:bad", "{not json"]]);
  const client = {
    get: async (key) => values.get(key) ?? null,
    multi() {
      const chain = {
        set: (...args) => { calls.push(["set", ...args]); return chain; },
        incr: (...args) => { calls.push(["incr", ...args]); return chain; },
        ttl: (...args) => { calls.push(["ttl", ...args]); return chain; },
        exec: async () => ["OK", 3, 42],
      };
      return chain;
    },
  };
  const store = new RedisAuthStore(client);
  const result = await store.hitRateLimit("k", 2, 60);
  assert.deepEqual(calls[0], ["set", "auth:rate:k", "0", { NX: true, EX: 60 }]);
  assert.equal(calls[1][0], "incr");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(await store.getSession("bad"), null);
});

test("v4: unexpected 5xx errors never expose internal messages", () => {
  const fsError = Object.assign(new Error("ENOENT: no such file or directory, open '/app/data/users.json'"), { code: "ENOENT" });
  assert.equal(publicErrorMessage(fsError, "generic"), "generic");
  assert.equal(httpStatusOf(fsError), 500);
  assert.equal(httpStatusOf({ status: "ECONNRESET" }), 500);
  assert.equal(publicErrorMessage(Object.assign(new Error("Not yours"), { status: 404 }), "generic"), "Not yours");

  let statusCode = null;
  let payload = null;
  const res = { headersSent: false, status(code) { statusCode = code; return this; }, json(value) { payload = value; return this; } };
  const originalError = console.error;
  console.error = () => {};
  try {
    strategyErrorHandler(fsError, { method: "GET", path: "/x" }, res, () => {});
  } finally {
    console.error = originalError;
  }
  assert.equal(statusCode, 500);
  assert.doesNotMatch(payload.error, /ENOENT|\/app\/data/);
});
