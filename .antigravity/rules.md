# HELMER SECURITY, ARCHITECTURE, AND CODE INTEGRITY PROTOCOL
# MANDATORY OPERATIONAL INVARIANTS ACROSS ALL SESSIONS

### ARCHITECTURAL BASELINE ANCHOR
- **Reference Commit**: `02ec9af`
- **Baseline Invariant**: The codebase state at commit `02ec9af` is the immutable architectural benchmark. When adding features, refactoring, or optimizing, strictly preserve the design patterns, defensive pipelines, and tenant isolation established in this commit. If in doubt about an implementation detail, inspect the patterns from commit `02ec9af`.
- **Zero Guard Truncation**: You are strictly FORBIDDEN from omitting, simplifying, or commenting out existing validation checks, locks, abort handlers, or security guards during refactors. Every defensive check in the original code must persist.
- **No Unauthorized Dependencies**: Do not introduce new external npm packages (especially networking, HTTP, or alternate parsing libraries) without explicit user confirmation.

---

### 1. MANDATORY PRE-COMMIT & INTEGRITY GATES
- **Pre-Commit Security Audit**: Before staging or committing, inspect full diffs. Verify that no API keys, secrets, private tokens, or debug flags (`DEBUG=true`, bypassed guards) exist.
- **Verification Gate**: Before declaring any task complete, run `npm run check` and `npm test`. All tests must pass (100%). Any failure or type error immediately blocks deployment and commits.
- **Error Hygiene**: Never expose raw database errors, stack traces, or internal exceptions in API responses. Log details internally and return sanitized, generic error payloads to clients.

---

### 2. STRICT VALIDATION & MASS ASSIGNMENT PREVENTION
- **Strict Schema Enforcement**: Every mutation route (`POST`, `PATCH`, `PUT`) MUST validate incoming JSON payloads using Zod `.strict()`. Reject unknown fields unconditionally.
- **No Object Spreading**: Never spread `...req.body` or raw change objects directly over persistent models.
- **Protected Core Fields**: System fields (`id`, `ownerId`, `createdAt`, `passwordHash`, `role`, `emailVerifiedAt`) must be strictly guarded at the repository layer against external modification. Whitelist updatable fields explicitly.

---

### 3. MULTI-TENANCY, STORAGE & IDOR PREVENTION
- **Tenant Sharding**: Strategies, chats, tasks, and telemetry must be partitioned into tenant shards using deterministic SHA-256 hashes (`tenantKey(ownerId)`).
- **Strict Ownership**: Every retrieval, mutation, or deletion query MUST enforce `ownerId === req.ownerId` (or `req.user.id`). Raw resource IDs must never be queried without scoped tenant verification.
- **Input Validation**: All incoming resource IDs (`chatId`, `strategyId`, `taskId`, `jobId`) must strictly pass UUID regex validation (`/^[0-9a-f-]{36}$/i`).
- **Atomic Concurrency**: All file and cloud state updates must be synchronized through `TenantLockManager` and committed using `writeJsonAtomically`.

---

### 4. AI EXECUTION & CONCURRENCY CONTROL (ALL GENERATION ROUTES)
- **Universal Scope**: Mandatory for `/api/ask`, `/api/strategy`, `/api/up`, and any future generation or streaming endpoints.
- **Per-Tenant Mutex**: All AI generation must pass through `createAskExecutionGuard`. A single `ownerId` cannot run concurrent generation requests (must return 429 `EXECUTION_BUSY`).
- **Capacity & Heartbeats**: Enforce global concurrent execution limits and Redis provider slots via atomic Lua scripts and heartbeat lease renewals.
- **Idempotency & Fingerprinting**: All mutating generation endpoints require an `Idempotency-Key` header (`^[A-Za-z0-9_-]{16,100}$`). Compute canonical payload fingerprints (`computePayloadFingerprint`) and reject mismatches with 409 `IDEMPOTENCY_CONFLICT`.
- **Budget Tracking**: Every AI model call must be reserved through `AiPolicy.reserveProvider()` to enforce daily per-user (`AI_USER_DAILY_USD`) and platform (`AI_PLATFORM_DAILY_USD`) micro-dollar spend ceilings.
- **Cancellation**: SSE streaming and generation promises must wire up `AbortController` to client disconnection events (`req.on("close")`) to immediately release model slots and leases.
- **Privacy Mode**: When `user.settings.modelImprovement === false`, interaction logging and telemetry MUST completely redact prompts and outputs (`[Zəruri əməliyyat qeydi - Məzmun ötürülmür]`), set `onlyNecessaryData: true`, and purge training candidates.

---

### 5. ARTIFACT GENERATION & TOOL EXECUTION (WORD, EXCEL, PPTX, PDF)
- **Worker Thread Sandbox**: Document compilation (`renderWord`, `renderExcel`, `renderPowerPoint`, `renderPDF`) must NEVER run on the main Node.js event loop. It must run inside isolated `worker_threads` with strict resource limits (max 256MB memory, <=30s timeout).
- **Zero Arbitrary Code / Zero Shell**: Never introduce `child_process`, `eval()`, `exec`, or dynamic script execution. Artifacts are pure typed data structures built from validated Zod specifications.
- **Buffer Pre-Flight Inspection**: Rendered file buffers must pass `validateRenderedFile()` before returning to clients or saving to R2:
  - Block XML External Entities (`<!DOCTYPE`, `<!ENTITY`).
  - Block VBA macros, active scripts, and embedded binary packages.
  - Enforce that external relationship targets strictly use `https://`.
- **Deterministic Storage Keys**: Cloud storage keys must strictly validate against `artifactKey` regex (`/^artifacts\/[a-f0-9]{64}\/[a-f0-9-]{36}\/.../`). Never pass unvalidated file paths to S3/R2 commands.

---

### 6. RESEARCH & EXTERNAL NETWORK BOUNDARIES (ZERO SSRF)
- **No Arbitrary Fetch / Scraping**: The server must NEVER perform direct HTTP requests (`fetch`, `axios`) to arbitrary user-supplied URLs.
- **Grounding Exclusivity**: Real-time web research must ONLY be conducted via the official Google Search Grounding tool through the `@google/genai` SDK.
- **Source Filtering & Sanitization**:
  - Filter all search results against `LOW_QUALITY_DOMAINS` and prioritize `HIGH_SIGNAL_DOMAINS`.
  - All web source URLs must be strictly sanitized (`https?://` only) to protect against malicious schemes (`javascript:`, `data:`).
  - Linked sources MUST be rendered in a compact chip format directly at the end of the response. Titles and domains must be safely rendered without raw `innerHTML`.

---

### 7. AUTHENTICATION, ADMIN RBAC & MFA
- **Password Security**: Use Argon2id (OWASP: 19MB RAM, t=2, p=1). Always use `DUMMY_PASSWORD_HASH` on non-existent accounts to eliminate timing side-channels.
- **Token Hygiene**: Plaintext session tokens, reset tokens, and verification codes must NEVER be stored. Always hash them with SHA-256 (`hashOpaqueToken`) before saving or querying.
- **Cookie Security**: Auth and guest cookies must use `HttpOnly`, `SameSite=Lax`, and `Secure` (mandatory in production).
- **Admin Access**: Admin API routes (`/admin/api/...`) strictly require both `requireAuth` and `requireAdmin`.
- **Admin MFA**:
  - TOTP secrets must be encrypted at rest with AES-256-GCM using `userId` as Additional Authenticated Data (AAD).
  - Verify OTP codes with replay attack protection (`afterTimeStep`).
  - Enforce maximum 5-minute MFA session validity for sensitive/export routes, 15-minute for read routes.

---

### 8. Ask Mode Web Search Grounding & Source Chips (Frontend XSS & Sanitization)
- **Grounding Source Chips**: Whenever an Ask mode answer involves web search grounding, the linked sources MUST be rendered in a compact chip format directly at the end of the response.
- **Strict URL Sanitization**: All web source URLs must be strictly sanitized (`https?://` only) to protect against malicious URL schemes (`javascript:`, `data:`).
- **Safe Rendering**: Web source titles and domains must be safely rendered without raw `innerHTML`.
- **Zero Raw HTML Injection**: Never render dynamic user data, database records, or AI outputs via raw `innerHTML`.
- **Safe DOM Construction**: Always sanitize with `escapeHtml(...)` or build nodes safely using `element(...)` / `textContent`.
- **URL Scheme Filtering**: Reject or sanitize unsafe URL schemes (`javascript:`, `data:`, `vbscript:`) on all dynamic links, redirects, and media embeds.

---

### 9. SESSIONS, RATE LIMITING & PRODUCTION SECRETS
- **Guest Sessions**: Guest sessions must be HMAC-signed (`signGuestId`). Any unsigned or forged guest cookie must be rejected and re-issued.
- **Production Secrets Zero-Fallback**: Missing `SESSION_SECRET`, `AUTH_SECRET`, or `REDIS_URL` in production (`NODE_ENV === "production"`) MUST throw a fatal runtime error on startup. Never silently fall back to default development keys.
- **IP Rate Limiting**: Identify rate limits strictly via trusted reverse-proxy IP headers (`req.ip || req.socket.remoteAddress`), never through spoofable raw client headers alone. Enforce strict limits on auth, password reset, and AI execution routes.