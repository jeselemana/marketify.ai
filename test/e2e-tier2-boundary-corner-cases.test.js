import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

import { GenerateRequestSchema, SaveStrategyRequestSchema } from "../src/domain/strategy.js";
import { FileStrategyRepository } from "../src/repositories/file-strategy-repository.js";
import { verifyGuestCookie, isValidGuestId, parseCookies } from "../src/http/session.js";

test("Tier 2 - Boundary 1: Malformed and adversarial UUID parameter validation", () => {
  const canonicalUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const routeParamRegex = /^[0-9a-f-]{36}$/i;

  const adversarialInputs = [
    // SQL Injection attempts
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "admin' --",
    // Path Traversal attempts
    "../../../../etc/passwd",
    "..\\..\\windows\\system32",
    "/var/log/helmer",
    // Command Injection attempts
    "; rm -rf / ;",
    "`id`",
    "$(whoami)",
    // Null byte and control characters
    "c716279f-07ec-448f-aa65-ec759160538a\0",
    "c716279f-07ec-448f-aa65-ec759160538a\n",
    "c716279f-07ec-448f-aa65-ec759160538a\r",
    // Truncated / Oversized
    "",
    "   ",
    "c716279f-07ec-448f-aa65-ec759160538", // 35 chars
    "c716279f-07ec-448f-aa65-ec759160538aa", // 37 chars
    "c716279f-07ec-448f-aa65-ec759160538a-overflow",
    // Non-hex characters
    "c716279f-07ec-448f-aa65-ec759160538z",
    "c716279f-07ec-448f-aa65-ec759160538!",
    "с716279f-07ec-448f-aa65-ec759160538a", // Cyrillic 'с' (U+0441)
  ];

  for (const input of adversarialInputs) {
    assert.equal(
      routeParamRegex.test(input),
      false,
      `Adversarial input "${input}" must fail route parameter regex validation`
    );
    assert.equal(
      canonicalUuidRegex.test(input),
      false,
      `Adversarial input "${input}" must fail canonical UUID regex validation`
    );
  }

  // Structural boundaries that fail canonical UUID validation
  const structuralInvalid = [
    "c716279f07ec448faa65ec759160538a", // 32 hex chars without hyphens
    "c716279f-07ec-448f-aa65-ec759160538-", // hyphen at end
    "-c716279f-07ec-448f-aa65-ec759160538", // hyphen at start
    "c716279f0-7ec-448f-aa65-ec759160538a", // misplaced hyphen
  ];

  for (const input of structuralInvalid) {
    assert.equal(
      canonicalUuidRegex.test(input),
      false,
      `Structural invalid input "${input}" must fail canonical UUID format`
    );
  }

  // Canonical valid UUIDs must pass
  const validUuid = randomUUID();
  assert.equal(canonicalUuidRegex.test(validUuid), true);
  assert.equal(routeParamRegex.test(validUuid), true);
  assert.equal(canonicalUuidRegex.test(validUuid.toUpperCase()), true);
});

test("Tier 2 - Boundary 2: Tampered, forged, and boundary guest tokens", () => {
  const validGuestId = `guest_${randomUUID()}`;

  // 1. Invalid separators & syntax
  assert.equal(verifyGuestCookie(""), null);
  assert.equal(verifyGuestCookie(null), null);
  assert.equal(verifyGuestCookie(undefined), null);
  assert.equal(verifyGuestCookie(12345), null);
  assert.equal(verifyGuestCookie(`${validGuestId}`), null, "Missing dot separator");
  assert.equal(verifyGuestCookie(`${validGuestId}.`), null, "Empty signature");
  assert.equal(verifyGuestCookie(`.${validGuestId}`), null, "Empty guestId");
  assert.equal(verifyGuestCookie(`${validGuestId}.sig1.sig2`), null, "Multiple dot separators");

  // 2. Invalid guestId prefix or format
  assert.equal(isValidGuestId("usr_c716279f-07ec-448f-aa65-ec759160538a"), false, "User prefix invalid for guest");
  assert.equal(isValidGuestId("admin_c716279f-07ec-448f-aa65-ec759160538a"), false, "Admin prefix invalid for guest");
  assert.equal(isValidGuestId(`guest_not-a-uuid`), false, "Non-UUID guest ID invalid");
  assert.equal(isValidGuestId(`guest_${randomUUID()}`), true, "Valid guest prefix and UUID");

  // 3. Forged signatures of varying lengths
  assert.equal(verifyGuestCookie(`${validGuestId}.1234567890`), null, "Truncated signature rejected");
  assert.equal(verifyGuestCookie(`${validGuestId}.${"a".repeat(64)}`), null, "Oversized signature rejected");
  assert.equal(verifyGuestCookie(`${validGuestId}.${"x".repeat(32)}`), null, "Non-hex signature rejected");

  // 4. Cookie parser edge cases
  const parsedEmpty = parseCookies("");
  assert.deepEqual(parsedEmpty, {});

  const parsedWeird = parseCookies("helmer_guest=val1; ; ; other=val2; malformed");
  assert.equal(parsedWeird.helmer_guest, "val1");
  assert.equal(parsedWeird.other, "val2");
  assert.equal(parsedWeird.malformed, "");

  const parsedUrlEncoded = parseCookies(`helmer_guest=${encodeURIComponent("guest_123.sig456")}`);
  assert.equal(parsedUrlEncoded.helmer_guest, "guest_123.sig456");
});

test("Tier 2 - Boundary 3: Double-click requests with duplicate idempotencyKey", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tier2-idemp-"));
  const repo = new FileStrategyRepository(path.join(tmpDir, "strategies.json"));
  const ownerId = `usr_${randomUUID()}`;
  const sharedKey = `idemp_doubleclick_${randomUUID()}`;

  const strategyData = {
    title: "Double-Click Strategy",
    summary: "Stress test summary",
    context: {},
    sections: [],
    priorities: [],
    actionPlan: [],
    kpis: [],
    risks: [],
    assumptions: [],
    nextSteps: [],
  };

  const payload = {
    clientSaveId: sharedKey,
    brief: "Valid brief for double-click test",
    answers: [],
    strategy: strategyData,
    versions: [{ versionNumber: 1, data: strategyData, createdAt: new Date().toISOString() }],
  };

  // Simulate double-click user submission: initial request followed immediately by retry/duplicate
  const firstResult = await repo.create(payload, ownerId);
  const secondResult = await repo.create(payload, ownerId);

  // Both submissions must return the identical strategy record
  assert.ok(firstResult.id, "First record has an ID");
  assert.equal(secondResult.id, firstResult.id, "Duplicate submission with identical idempotencyKey must return existing ID");

  // Repository must contain exactly one record
  const allRecords = await repo.list(ownerId);
  assert.equal(allRecords.length, 1, "Repository must persist exactly 1 record without duplicates");

  // Test idempotencyKey boundary validation in schemas: min 8 characters required
  assert.equal(
    GenerateRequestSchema.safeParse({ brief: "Valid brief text", idempotencyKey: "short" }).success,
    false,
    "idempotencyKey < 8 characters must be rejected"
  );
  assert.equal(
    SaveStrategyRequestSchema.safeParse({ clientSaveId: "short", brief: "Valid brief text", strategy: strategyData, versions: [] }).success,
    false,
    "clientSaveId < 8 characters must be rejected"
  );

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Tier 2 - Boundary 4: Invalid, dangerous, and adversarial citation URLs", () => {
  function sanitizeCitationUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return null;
    const trimmed = rawUrl.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }
      return null;
    } catch {
      return null;
    }
  }

  const adversarialUrls = [
    // XSS & Code Execution schemes
    "javascript:alert(document.cookie)",
    "javascript://%0aalert(1)",
    "vbscript:msgbox(\"xss\")",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "data:text/javascript,alert(1)",
    "blob:https://helmer.ai/00000000-0000-0000-0000-000000000000",
    // Local / File system access
    "file:///etc/passwd",
    "file:///C:/Windows/win.ini",
    // Other unsupported protocols
    "ftp://anonymous@ftp.example.com",
    "ws://streaming.example.com",
    "gopher://gopher.example.com",
    "mailto:victim@example.com",
    // Malformed URLs
    "http://",
    "https://",
    "http:///",
    "://example.com",
    "htp://misspelled.com",
    "example.com/no-protocol",
    "   ",
    null,
    undefined,
  ];

  for (const dangerous of adversarialUrls) {
    assert.equal(
      sanitizeCitationUrl(dangerous),
      null,
      `Dangerous or malformed URL "${dangerous}" must be rejected`
    );
  }

  // Legitimate citations must pass
  assert.equal(
    sanitizeCitationUrl("https://forbes.com/business-growth"),
    "https://forbes.com/business-growth"
  );
  assert.equal(
    sanitizeCitationUrl("http://reuters.com/markets"),
    "http://reuters.com/markets"
  );
  assert.equal(
    sanitizeCitationUrl("https://statista.com/statistics/12345/?filter=az"),
    "https://statista.com/statistics/12345/?filter=az"
  );
});
