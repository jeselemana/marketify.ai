# Security Policy & Operational Protocols

## Reporting Security Issues

If you discover a security vulnerability within Helmer / Marketify.ai, please send an email to the security team or repository administrator. Please do not disclose vulnerabilities publicly until they have been patched.

---

# Helmer Security, Architecture, and Code Integrity Rules

These directives are MANDATORY and NON-NEGOTIABLE across all coding, refactoring, feature implementation, and deployment sessions in the Helmer project. Any deviation, simplification, or shortcut is strictly forbidden.

---

### ARCHITECTURAL BASELINE ANCHOR
- **Reference Commit**: `02ec9af`
- **Baseline Invariant**: The codebase state at commit `02ec9af` is the immutable architectural benchmark. When adding features, refactoring, or optimizing, strictly preserve the patterns, defensive pipelines, and tenant isolation established in this commit. If in doubt about an implementation detail, inspect the patterns from commit `02ec9af`.
- **Zero Guard Truncation**: You are strictly FORBIDDEN from omitting, simplifying, or commenting out existing validation checks, locks, abort handlers, or security guards during refactoring. Every defensive check in the original code must persist.
- **No Unauthorized Dependencies**: Do not introduce new external npm packages (especially networking, HTTP, or alternate parsing libraries) without explicit confirmation. Rely strictly on verified internal utilities.

---

### 1. Mandatory Pre-Commit & Verification Gates
- **Security Diff Review**: Before every git commit, perform a full security review. Verify that no secrets, credentials, API keys, private tokens, debug routes, or bypass flags (`DEBUG=true`, bypassed guards) exist or are staged.
- **Strict Verification Gate**: Before declaring any task, feature, refactor, or commit complete, run `npm run check` and `npm test`. All tests must pass (100%). Any failure, type error, or syntax mismatch blocks completion immediately.
- **Error Hygiene (No Leaks)**: Never expose raw database errors, stack traces, or internal error messages in API responses. Log details internally and return sanitized, generic error payloads to clients.

---

### 2. Strict Validation & Mass Assignment Prevention
- **Strict Schema Enforcement**: Every mutation route (`POST`, `PATCH`, `PUT`) MUST validate incoming JSON payloads using Zod `.strict()`. Reject unknown fields unconditionally.
- **No Direct Object Spreading**: Never spread `...req.body` or `...changes` directly over persistent data models.
- **Protected Core Fields**: Core system fields (`id`, `ownerId`, `createdAt`, `passwordHash`, `role`, `emailVerifiedAt`) MUST be strictly guarded at the repository layer against external modification. Whitelist updatable fields explicitly.

---

### 3. Multi-Tenancy, Storage & IDOR Prevention
- **Tenant Sharding**: Strategies, chats, tasks, and telemetry must be partitioned into tenant shards using deterministic SHA-256 hashes (`tenantKey(ownerId)`). Never store multi-tenant records in un-sharded, flat global arrays.
- **Strict Ownership**: Every retrieval, mutation, or deletion query MUST enforce `ownerId === req.ownerId` (or `req.user.id`). Raw resource IDs must never be queried without scoped tenant verification.
- **Input Validation**: All incoming resource IDs (`chatId`, `strategyId`, `taskId`, `jobId`) must strictly pass UUID regex validation (`/^[0-9a-f-]{36}$/i`).
- **Atomic Concurrency**: All file and cloud state updates must be synchronized through `TenantLockManager` and committed using `writeJsonAtomically`.

---

### 4. AI Execution & Concurrency Control (All Generation Routes)
- **Universal Scope**: Mandatory for `/api/ask`, `/api/strategy`, `/api/up`, and any future generation or streaming endpoints.
- **Per-Tenant Mutex**: All AI generation must pass through `createAskExecutionGuard`. A single `ownerId` cannot run concurrent AI generation requests (must return 429 `EXECUTION_BUSY`).
- **Platform-Wide Capacity & Heartbeats**: Enforce global concurrent execution limits and Redis provider slots via atomic Lua scripts and heartbeat lease renewals.
- **Idempotency & Fingerprinting**: All mutating generation endpoints require an `Idempotency-Key` header (`^[A-Za-z0-9_-]{16,100}$`). In Build mode, always compute canonical payload fingerprints (`computePayloadFingerprint`) and reject parameter mismatches with 409 `IDEMPOTENCY_CONFLICT`.
- **Budget Tracking**: Every AI model call must be reserved through `AiPolicy.reserveProvider()` to enforce daily per-user (`AI_USER_DAILY_USD`) and platform (`AI_PLATFORM_DAILY_USD`) micro-dollar spend ceilings.
- **Cancellation**: SSE streaming and generation promises must always wire up `AbortController` to client disconnection events (`req.on("close")`) to immediately release model slots and leases.
- **Privacy Mode (Model Improvement)**: When `user.settings.modelImprovement === false`, interaction logging and telemetry MUST completely redact prompts and outputs (`[Zəruri əməliyyat qeydi - Məzmun ötürülmür]`), set `onlyNecessaryData: true`, and purge training candidates.

---

### 5. Artifact Generation & Tool Execution (Word, Excel, PPTX, PDF)
- **Worker Thread Sandbox**: Document compilation (`renderWord`, `renderExcel`, `renderPowerPoint`, `renderPDF`) must NEVER run on the main Node.js event loop. It must strictly run inside isolated `worker_threads` with strict resource limits (max 256MB memory, <=30s timeout).
- **Zero Arbitrary Code / Zero Shell**: Never introduce `child_process`, `eval()`, `exec`, or dynamic script execution. Artifacts are pure typed data structures built from validated Zod specifications (`spec`).
- **Buffer Pre-Flight Inspection**: Rendered file buffers must pass `validateRenderedFile()` before returning to clients or saving to R2:
  - Block XML External Entities (`<!DOCTYPE`, `<!ENTITY`).
  - Block VBA macros, active scripts, and embedded binary packages.
  - Enforce that external relationship targets strictly use `https://`.
- **Deterministic Storage Keys**: Cloud storage keys must strictly validate against `artifactKey` regex (`/^artifacts\/[a-f0-9]{64}\/[a-f0-9-]{36}\/.../`). Never pass unvalidated file paths to S3/R2 commands.

---

### 6. Research Boundaries, Grounding & Source Chips (Zero SSRF)
- **No Arbitrary Fetch / Scraping**: The server must NEVER perform direct HTTP requests (`fetch`, `axios`) to arbitrary user-supplied URLs.
- **Grounding Exclusivity**: Real-time web research must ONLY be conducted via the official Google Search Grounding tool through the `@google/genai` SDK.
- **Source Filtering & Sanitization**:
  - Filter all search results against `LOW_QUALITY_DOMAINS` and prioritize `HIGH_SIGNAL_DOMAINS`.
  - All web source URLs must be strictly sanitized (`https?://` only) to protect against malicious URL schemes (`javascript:`, `data:`).
  - Linked sources MUST be rendered in a compact chip format directly at the end of the response. Titles and domains must be safely rendered without raw `innerHTML`.

---

### 7. Authentication, Admin RBAC & MFA
- **Password Security**: Use Argon2id (OWASP: 19MB RAM, t=2, p=1). Always use `DUMMY_PASSWORD_HASH` on non-existent accounts to eliminate timing side-channels.
- **Token Storage Hygiene**: Plaintext session tokens, reset tokens, and verification codes must NEVER be stored. Always hash them with SHA-256 (`hashOpaqueToken`) before saving or querying.
- **Cookie Security**: Auth and guest cookies must use `HttpOnly`, `SameSite=Lax`, and `Secure` (mandatory in production).
- **Admin Access & MFA**:
  - Admin API routes (`/admin/api/...`) strictly require both `requireAuth` and `requireAdmin`.
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
- **URL Scheme Filtering**: Reject or sanitize unsafe URL schemes (`javascript:`, `data:`, `vbscript:`) on dynamic links and media embeds.

---

### 9. Sessions, Rate Limiting & Production Secrets
- **Guest Sessions**: Guest sessions must be HMAC-signed (`signGuestId`). Any unsigned or forged guest cookie must be rejected and re-issued.
- **Production Secrets Zero-Fallback**: When `NODE_ENV === "production"`, missing `SESSION_SECRET`, `AUTH_SECRET`, or `REDIS_URL` must immediately throw a fatal error on startup. Never silently fall back to default development keys.
- **IP Rate Limiting**: Identify rate limits strictly via trusted reverse-proxy IP headers (`req.ip || req.socket.remoteAddress`), never through spoofable raw client headers alone. Enforce strict limits on auth, password resets, and AI generation endpoints.
