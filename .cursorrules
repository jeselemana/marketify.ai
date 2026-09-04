# Helmer Security, Architecture, and Code Integrity Rules

These directives are MANDATORY and NON-NEGOTIABLE across all coding, refactoring, feature implementation, and deployment sessions in the Helmer project. Any deviation or shortcut is strictly forbidden.

---

### 1. Mandatory Pre-Commit Security Check
- Before every git commit, you MUST perform a full security and integrity review.
- Verify that no secrets, credentials, API keys, private tokens, or sensitive environment variables are being introduced or staged.
- Verify that no unprotected endpoints, temporary debug routes, or bypass flags remain in the codebase.
- Inspect all file diffs thoroughly before staging or committing changes.

---

### 2. Strict Validation & Mass Assignment Prevention
- Every mutation route (`POST`, `PATCH`, `PUT`) MUST validate inputs using Zod `.strict()`.
- Never spread `...req.body` or `...changes` directly over data models.
- Core system fields (`id`, `ownerId`, `createdAt`, `passwordHash`, `role`, `emailVerifiedAt`) MUST be strictly guarded against external modification at the repository layer.
- Ensure mutation methods only update explicitly whitelisted fields.

---

### 3. Tenant Isolation & IDOR Prevention
- Strict tenant isolation MUST be enforced across all data access operations.
- Operations on strategies, chats, and planner tasks MUST enforce `ownerId === req.ownerId` (or `req.user.id`).
- Strictly validate UUID formats (`/^[0-9a-f-]{36}$/i`) on all resource IDs before querying or persisting data.
- Never trust client-provided owner claims or access records without explicit ownership verification.

---

### 4. Frontend XSS Protection
- Never render dynamic user data or database records via raw `innerHTML`.
- Always sanitize with `escapeHtml(...)` or build nodes safely using `element(...)` / `textContent`.
- Reject or sanitize unsafe URL schemes (`javascript:`, `data:`) on dynamic links and media embeds.

---

### 5. Sessions & Production Secrets
- Guest sessions must be HMAC-signed (`signGuestId`). Any unsigned or forged guest cookie must be rejected and re-issued.
- Missing secrets (`SESSION_SECRET`, `AUTH_SECRET`) in production (`NODE_ENV === "production"`) MUST throw a fatal runtime error.
- Never fall back to insecure default secrets in production environments.

---

### 6. IP Rate Limiting
- Identify guest rate limits strictly via `req.ip || req.socket.remoteAddress`, never through spoofable raw headers alone.
- Enforce appropriate rate limits on sensitive routes (authentication, AI generation, password resets).

---

### 7. Verification Gate
- Before declaring any task, feature, refactor, or commit complete, run `npm run check` and `npm test`.
- All tests must pass (100%). Any failure, syntax error, or test failure blocks completion and commits immediately.
