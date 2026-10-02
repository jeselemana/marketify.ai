# Helmer Test Infrastructure & Engineering Guide

## 1. Overview & Test Architecture

Helmer is an enterprise marketing strategy platform built on Node.js (v20–v22) using native ES Modules (`"type": "module"`). The test architecture adheres strictly to zero third-party test runners: all test suites execute through Node's native test runner (`node --test`), providing deterministic, ultra-fast test execution without Babel, Jest, or TypeScript compilation overhead.

### Core Testing Principles
1. **Behavioral Integrity**: Tests verify real domain behaviors, interface contracts, and security boundaries rather than facade assertions or mock internals.
2. **Deterministic Isolation**: Every test creates independent, ephemeral storage in temporary directories (`os.tmpdir()`) and guarantees complete lifecycle cleanup (`t.after` or `fs.rm`).
3. **Defense in Depth**: Tests validate the entire defense stack: Zod `.strict()` schema parsing, repository mass-assignment guards, tenant isolation filters (`ownerId === req.ownerId`), cryptographic HMAC cookies, and concurrency locks.
4. **Sandboxing Resilience**: In-memory handler execution (`router.handle`) is prioritized for speed and sandbox safety, while socket integration tests document explicit loopback network requirements.

---

## 2. Test Runner & Commands

### Complete Test Suite
```bash
npm test
```
*Executes `node --test "test/*.test.js"`, discovering all 55+ test suites across unit, integration, and E2E tiers.*

### Syntax & Static Check Gate
```bash
npm run check
# or
npm run build
```
*Validates JavaScript syntax via `node --check` across 55 core backend and frontend files, and verifies artifact builders via `scripts/check-artifacts.js`.*

### Running Specific Tiers
```bash
# Tier 1: Core Feature Coverage
node --test test/e2e-tier1-feature-coverage.test.js

# Tier 2: Boundary & Corner Cases
node --test test/e2e-tier2-boundary-corner-cases.test.js

# Tier 3: Cross-Feature Combinations & Concurrency
node --test test/e2e-tier3-cross-feature-combinations.test.js

# Tier 4: Real-World E2E Scenarios
node --test test/e2e-tier4-real-world-scenarios.test.js
```

### Running Targeted Subsystem Tests
```bash
# Auth & Sessions
node --test test/auth.test.js test/account-deletion.test.js

# Strategy & Build Engine
node --test test/build-routing.test.js test/strategy-repository.test.js test/strategy-domain.test.js

# Ask, Chat & Background Research
node --test test/ask-routing.test.js test/ask-deep-research.test.js test/capabilities.test.js

# UP Progression Engine
node --test test/up.test.js test/up-ui.test.js
```

---

## 3. Four-Tier Test Inventory

| Tier | Purpose | Coverage Areas | Key Suites |
|---|---|---|---|
| **Tier 1: Feature Coverage** | Verify primary functionality and security guarantees of each subsystem | - Zod `.strict()` schema rejection on mutation endpoints<br>- FileUserRepository mass assignment guards<br>- HMAC guest session signing & tampering rejection<br>- 14-day deletion lifecycle & session invalidation<br>- IP rate limiting across sensitive endpoints<br>- Strategy concurrency locking & idempotency<br>- Streaming SSE keepalive & abort handling<br>- Citation URL sanitization (`https?://`)<br>- Sharded multi-tenant storage & isolation<br>- UUID parameter validation | `test/e2e-tier1-feature-coverage.test.js`, `test/auth.test.js`, `test/strategy-repository.test.js`, `test/account-deletion.test.js` |
| **Tier 2: Boundary & Corner Cases** | Stress edge conditions, malformed payloads, and injection vectors | - Malformed/injected UUIDs (SQLi, path traversal, oversized)<br>- Tampered HMAC cookies (bit flips, invalid separators)<br>- Concurrent double-click requests with identical idempotencyKey<br>- Invalid citation URLs (`javascript:`, `file:`, `data:`, loopback) | `test/e2e-tier2-boundary-corner-cases.test.js` |
| **Tier 3: Cross-Feature Combinations** | Verify multi-system interactions, concurrent mutations, and lifecycle flows | - Concurrent multi-tenant repository writes (no data loss)<br>- Guest claim-to-user workflows (`claimOwner` data migration)<br>- Stream disconnects and abort propagation | `test/e2e-tier3-cross-feature-combinations.test.js` |
| **Tier 4: Real-World Scenarios** | End-to-end user journeys mirroring complete production interactions | - Full guest-to-registered user lifecycle (build -> ask -> signup -> claim -> settings -> deletion)<br>- Multi-tenant concurrent isolation stress | `test/e2e-tier4-real-world-scenarios.test.js` |

---

## 4. Test Environment & Sandboxing Guidelines

### Local Filesystem vs Network Sockets
- **Repository & Domain Unit Tests**: Run entirely within temporary folders created via `fs.mkdtemp`. These execute identically inside and outside sandboxes.
- **In-Memory Express Route Tests**: Test Express routers directly using `router.handle(req, res)` with mocked request/response objects. They do not bind TCP ports and require no loopback network privileges.
- **Full HTTP Integration Tests**: Test files that launch real HTTP servers via `app.listen(0, "127.0.0.1")` and execute client `fetch()` (such as `test/capabilities.test.js` and `test/up.test.js`) require OS socket loopback permission. When running in restricted sandboxes, ensure `BypassSandbox: true` is enabled to allow `127.0.0.1` ephemeral port binding.

---

## 5. Authoritative Expected Output Derivation

All expected values in the test suites are derived directly from authoritative system specifications:
1. **`.cursorrules` & `.antigravity/rules.md`**:
   - Zero tolerance for unrecognized properties in mutations (`ZodError` on extra keys).
   - Core fields (`id`, `ownerId`, `createdAt`, `passwordHash`, `role`, `emailVerifiedAt`) immutable at repository layer.
   - All route IDs strictly match UUID v4 regex `/^[0-9a-f-]{36}$/i`.
   - Strict tenant isolation: `record.ownerId === req.ownerId`.
2. **`PROJECT.md` & `ORIGINAL_REQUEST.md`**:
   - 14-day deletion lifecycle with cascading cleanup and complete session invalidation.
   - 15-second heartbeat ping (`: keepalive\n\n`) on long-lived SSE connections.
   - Safe URL protocol restriction (`https?://` only) for AI grounding citations.
