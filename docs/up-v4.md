# Helmer UP v4

UP uses the existing Express/auth infrastructure, shared Helmer design tokens, OpenAI client, central model configuration, telemetry and R2 storage client. Build and Ask personalization are independent. No UP activity modifies their settings or prompts.

## Entry and API

Desktop rail and the shared desktop/mobile sidebar include UP. `/workspace?view=up` opens it directly. The guest CTA invokes the existing authentication flow and preserves the return path.

All `/api/up` routes require a real account session. Mutations use strict Zod schemas and never accept model IDs, owners, Points, levels, timestamps or rubric weights from the client. The app's existing origin/CSRF policy also applies. Responses are `no-store`.

- `GET /`: dashboard, goals, skills, current challenge and latest 10 completed challenges; no model call.
- `POST /opened`: non-sensitive open analytics; no streak or Points.
- `POST /onboarding`: goals, interests and valid IANA timezone; one-time only.
- `PATCH /preferences`: goals and interests; does not erase earned activity.
- `POST /challenges`: resume a pending challenge or generate one.
- `GET /challenges/:id`: owner-scoped challenge and immutable submitted answer.
- `POST /challenges/:id/submit`: persist an answer snapshot, evaluate and commit reward.
- `POST /challenges/:id/retry`: evaluate the same persisted answer after failure/interruption.

Language is limited to `az` or `en`. Answers are 10–8,000 trimmed characters. IDs are UUIDs. Another account cannot read, submit or retry a challenge.

## Persistence and migration

This repository's database is its existing file/R2 store, rather than SQL. `up-migrations.js` creates a schema-version-1 profile when none exists and rejects unknown versions/ownership mismatches. No migration changes the existing users, chats, planner or strategy formats.

R2 stores one private `data/up-v1/<sha256(ownerId)>.json` object per account. Conditional `If-Match` / `If-None-Match` writes make answer state, evaluation, Points transaction, goals, streak, level, skills and analytics outbox one atomic commit. Optimistic conflicts reload and retry only synchronous mutations, never model requests. Configured R2 failures propagate; they do not fall back to ephemeral disk. Redis is not required for reward correctness across replicas.

Without R2, the same schema is written to `DATA_DIR/up-v1` with a cross-process filesystem lock, fsynced temporary file and atomic rename. Production using this path requires a persistent shared disk. A crashed process's lock is recovered only after its PID is proven dead. Storage is bounded to 20 MiB per account; reaching that limit fails explicitly without losing existing data.

Generated/completed challenges, answers, evaluations and the audit ledger persist in the account object. Each transaction has owner, challenge, timestamp, local day/week, scoring version and breakdown. Account purge clears UP data and writes a tombstone so an in-flight model request cannot recreate deleted content.

## AI and cost bounds

`aiConfig.upModel` is fixed server-side to `gpt-6-luna`. Both generation and evaluation use the existing OpenAI client, Responses API strict JSON schema and Zod validation. There is no alternate model fallback. Unavailable/unconfigured model responses surface as explicit errors.

Requests set `store: false`, low reasoning effort, 3,000 maximum output tokens, a 45-second timeout and zero SDK retries. One controlled retry is permitted for malformed/invalid structured outputs; generation also retries near-duplicates once. No model request is made by a dashboard render or refresh.

A persisted generation/evaluation lease (125 seconds) excludes concurrent calls across replicas. Late results must match their lease token before committing. Daily budgets are 30 generation reservations and 60 evaluation reservations; evaluation is limited to eight reservations per challenge. Each reservation allows at most two model requests. An account/IP burst limit bounds ordinary route traffic. The user's practice timezone is fixed at onboarding to prevent timezone hopping from resetting budgets/goals/streak.

Context includes selected category/type/difficulty, seven aggregate skill records and at most 25 short history summaries. Duplicate checks inspect at most 50 recent challenges, matching topic keys and number-normalized word shingles. This is a bounded lightweight similarity heuristic, not a guarantee of semantic uniqueness across languages.

## Scoring and progression

Generation returns 2–5 distinct applicable rubric dimensions, observable criteria and integer relative weights 1–5. The client sees dimension names, not the hidden evaluation criteria. Evaluation returns exactly those dimensions with scores 0–4, evidence, strength, omission and improvement. Instructions inside answers are treated as untrusted data.

Maximum Points are `[40, 55, 75, 100]` at difficulties 1–4, with +5 for numbers, strategy and AI types. Weighted score quality is `sum(weight * score) / (4 * sum(weight))`. Backend Points are rounded from maximum × quality. Breakdown rows use largest-remainder allocation so they sum exactly to the total. LLM-provided Points or extra fields are rejected.

The challenge ID is the permanent submission/reward idempotency key. A second answer cannot replace the first. One completed challenge has one evaluation result and one transaction. Network retries return that same result. Model/storage failure leaves the saved answer available for retry and commits no unvalidated reward.

Daily and Monday-based weekly progress derive from server completion timestamps in the fixed IANA timezone. Goals can change without changing earned Points. Streak increases only on a completed challenge, once per local day, and resets after a gap. Opening, refreshing or generating a challenge never increments it.

Level `L` starts at `100*(L-1)*L` total Points and ends at `100*L*(L+1)`. Skill targets combine quality, difficulty and capped distinct-day consistency; an exponential moving average weights the latest practice at 30%. Skills are practice indicators, not psychometric measurements.

Selection prioritizes unpracticed/weaker chosen interests, penalizes the last two repeated categories, and rotates challenge types. Category-specific recent quality raises/lower difficulty after at least two samples, bounded to 1–4. A new skill can start slightly higher for advanced levels. Feedback history stays scoped to UP.

## Observability

Structured logs identify model routing, latency/token counts, malformed output, generation/evaluation failures, reward commit failures and duplicate prevention without logging answer text. Existing telemetry records UP opened, onboarding, goal changes, challenge started/submitted/completed, evaluation failed, Points earned, goal completion, level and streak changes. A bounded persisted outbox retries delivery on subsequent UP mutations. Analytics payloads contain IDs/counts/categories rather than answers.

## Verification (1 October 2026, Asia/Baku)

- Full suite: 329 passed, zero failed; `check` and `build` passed. See [machine-readable evidence](up-verification.json), [desktop](up-desktop.jpg) and [mobile](up-mobile.jpg) screenshots.
- Automated domain/repository/API tests: persistence, strict mutation inputs, arbitrary Points rejection, immutable answer, concurrent submission, replay, failed evaluation/retry, expired leases, malformed output, Baku midnight/Monday/year/DST, goals/streak/levels/skills, adaptive difficulty, duplicate prevention, cloud CAS conflicts, fail-closed storage and deletion tombstones.
- API tests use real file-backed account/session middleware and login/logout routes; they verify another verified account receives 404 for foreign challenge IDs.
- UI tests use jsdom for onboarding, real response rendering, safe text/XSS behavior, submitted-answer recovery, retry/breakdown, stale-account responses and navigation wiring.
- Live `scripts/test-up-live.js` uses the real server, an isolated verified account and actual GPT-6 Luna. It validates generation, rubric evaluation, bounded deterministic Points, replay and logout/login persistence.
- Live `scripts/test-up-live.js --cloud` checks actual R2 conditional concurrent writes, generation/evaluation, one ledger transaction and replay; its unique test account object is cleared to a tombstone afterwards.
- Desktop 1440px and mobile 390px browser QA inspect dashboard, navigation, persisted progress, submitted answer and real feedback/breakdown. Horizontal document width equals viewport width. A second scenario was generated through Next Challenge, submitted in the browser and evaluated for +38 Points; the refreshed dashboard displayed 54 total Points.

Run `npm run check`, `npm test`, `npm run build`. This JavaScript project has no separate TypeScript or ESLint setup; `check` is the existing syntax/integrity gate. Live tests require API/network access and consume a small number of real requests. `--serve` keeps the isolated server running for browser QA until interrupted. Do not deploy that test account/server.
