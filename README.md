# Marketify AI

Marketify AI is an AI strategy workspace built on the project's existing Express and vanilla JavaScript stack. It turns a business brief into a structured strategy, selectively asks for clarification, supports versioned refinements, saves work to an owner-scoped MVP repository, and exports strategy content locally.

## Run locally

1. Copy `.env.example` to `.env` and add API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`).
2. Install dependencies with `npm install`.
3. Start with `npm start`.
4. Open `http://localhost:5050` in the browser.

## Configuration

- `OPENAI_API_KEY` — required for assessment, generation, and refinement (Build mode).
- `GEMINI_API_KEY` — required for Gemini 3.7 Flash Ask mode and Live Search Grounding.
- `OPENAI_STRATEGY_MODEL` — generation/refinement model; defaults to `gpt-5.6-terra`.
- `OPENAI_ASK_MODEL` — model for Ask mode; defaults to `gpt-5.6-luna`.
- `GEMINI_ASK_MODEL` — Gemini model for Ask mode; defaults to `gemini-3.7-flash`.
- `MAX_CLARIFICATION_ROUNDS` — defaults to `2`.
- `PORT` — defaults to `5050`.
- `APP_URL` — the canonical public origin, for example `https://marketify-ai.com`.
- `TRUSTED_ORIGINS` — optional comma-separated additional browser origins.
- `REDIS_URL` — recommended in production; used as the primary session, password-reset-token, rate-limit, and repository cache store.
- `RESEND_API_KEY`, `EMAIL_FROM` — Resend HTTP API ilə e-poçt təsdiq kodu və şifrə bərpası göndərişi. `EMAIL_FROM` Resend-də təsdiqlənmiş domenə aid olmalıdır. SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`) alternativ olaraq dəstəklənir.
- `ADMIN_USERNAMES` — comma-separated usernames allowed to access the admin dashboard (`/admin`).

## Data and ownership

Marketify uses first-party username/email + password authentication. Passwords are hashed with Argon2id. An opaque, cryptographically random session token is stored only in the `marketify_session` HttpOnly, SameSite cookie; only its SHA-256 digest is used as the server-side session key. Product APIs require an authenticated user and saved strategies are scoped to that immutable user ID.

The MVP user repository is an atomically written, versioned `data/users.json` store. `src/repositories/auth-store-migrations.js` upgrades the persisted schema without rewriting strategy records. Existing guest-owned strategies are claimed by the new user on the first successful signup/login from that browser. For multi-instance production deploys, attach a persistent disk for `data/users.json` and `data/strategies.json`, and configure Redis for sessions. A later SQL migration can replace the repository implementation without changing the auth/API contract.

Password reset tokens are random, stored only as hashes, expire after 20 minutes, and are consumed once. Changing or resetting a password invalidates other/all active sessions respectively. State-changing browser requests are origin-checked, CORS is allowlisted, and security headers are applied globally.

## Authentication API

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/username-availability`
- `PATCH /api/auth/account`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/onboarding`

## Export status

- HTML document export: implemented locally.
- CSV spreadsheet export: implemented locally with normalized priority, action-plan, KPI, and risk rows.
- Google Docs, Google Sheets, and connected Excel: visibly marked as coming soon; no connection is faked.

## Verification

- `npm run check` — JavaScript syntax checks.
- `npm test` — auth hashing/session/reset flows plus domain, refinement-context, versioning, and ownership tests.
- `npm run build` — complete static-app validation (`check` + `test`).
