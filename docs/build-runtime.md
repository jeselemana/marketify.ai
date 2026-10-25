# Build hybrid orchestration

Build generation and refinement use `build-orchestrator.js` and a separate immutable `build-config.js` contract. Ask, Research, UP, artifacts and Planner retain their existing model routes.

## Request flow

- Small: GPT-6 Luna → Gemini 3.8 Flash (HIGH) → final strategy.
- Medium/complex: GPT-6 Luna → Gemini 3.8 Flash (HIGH) → GPT-6.1 Sol → final strategy. Sol receives the validated preliminary objective, context, plan, constraints, acceptance criteria, evidence and uncertainties, alongside original requirements. On success there is no subsequent model call; the bounded recovery paths below apply only after provider failure.
- Existing intake/clarification is preserved as a separate preliminary operation: Luna → Gemini assessment, with no search or final-strategy synthesis. Generation is routed against the completed intake; routing is never accepted from the client.

Luna returns strict enums/booleans for complexity, low/medium/high reasoning, Google Search, optional Sol search, and task-essential profile fields. Invalid/inconsistent decisions stop execution. Luna is never used as a fallback or final producer. A valid Luna route remains mandatory. Provider recovery is bounded to one cross-provider fallback:

- Gemini context/direct output failure → Sol completes the original validated task directly, without invalid partial context or raw profile data.
- Sol final output failure → Gemini completes the final brief using original requirements and the validated handoff.
- Both providers failing ends the request; there is no bounce loop.

Eligible failures include upstream rate limits, availability/auth/model errors, malformed or truncated output, and timeouts reported by the provider itself. Elapsed time alone never triggers a model switch. Client disconnection, lost leases, revoked permissions/consent, budget configuration/ceilings, provenance/grounding violations and safety refusals remain terminal. A fallback obtains a fresh provider reservation and revalidates authoritative execution permission. The replacement can inherit an existing Luna external-evidence grant; it cannot enable search when Luna and the server have disabled it. No model-name guessing is used. Refinement classification uses a compact summary; full strategy context goes to the workhorse and final strategist.

Google Search, when authorized, runs in the same Gemini call as context analysis/strategy generation. Gemini receives no search tool otherwise. Sol receives only hosted Responses `web_search` when Luna permits additional verification; it can make at most two calls. `ENABLE_BUILD_SEARCH_GROUNDING=false` disables both providers' search. URL-context, arbitrary HTTP fetching and executable tools are never provided.

The final producer uses provider streaming where supported. Its bounded chunks are published only after complete schema validation, so failed-attempt prefixes never mix with replacement output. Build continues rendering its result on the done event. Router decisions and intermediate handoffs remain private. Final JSON must satisfy the existing strategy schema before a done event or persistence. Model-authored orchestration metadata is rejected; source attribution is authored by the server from provider metadata. Existing source chips render the safe links; internal model metadata is not presented in the UI.

## Privacy and security

Both `personalIntelligence` and `strategyPersonalization` must explicitly be true. The existing profile whitelist excludes identity, email, credentials, memories and custom instructions. Luna sees no profile values. Only selected task-essential fields go to Gemini as untrusted data. Sol receives task-relevant information through the handoff. Account/privacy epoch changes invalidate in-flight execution through the existing provider authorization checks.

The HTTP path retains strict Zod schemas, canonical fingerprints, durable replay/tenant storage, distributed locks, execution leases, guest policy, rate limiting and privacy-safe logging. Build additionally passes through `createAskExecutionGuard`, including the active Research check. Client disconnection propagates cancellation through the existing controllers. Each production SDK call uses the existing `wrapProvider`/`AiPolicy.reserveProvider` budget and slot admission. No dependencies were added.

At the user's explicit instruction, Build has no application-imposed model stage, router, or total generation wall-clock deadline. It waits for completion until the caller cancels, disconnects, authorization changes, a lease is lost, a policy/budget blocks execution or the provider returns an error. Other modes retain their existing 180s request deadline. Renewable ownership/provider-slot leases keep their original TTLs and heartbeats; a lease TTL is not a generation cutoff.

Build uses a dedicated OpenAI v4 SDK adapter that omits its internal deadline timer and deadline header while preserving caller cancellation before headers and during SSE. Its dedicated socket agent does not change other modes' agents. The installed SDK's `timeout:0` would immediately abort, so setting that flag on the ordinary client would be incorrect. Gemini Build calls explicitly use `httpOptions.timeout:0` and one SDK attempt. Provider/network infrastructure can still impose its own limits.

The added “about 5000 output tokens” brevity directive was also removed. Strict schemas, memory/output size caps, provider token reservations, daily budgets, rate limits, retry/attempt bounds, tenant mutexes and privacy checks remain enforced. Final chunks are published only after full validation. User cancellation and security-policy failures never cause fallback. Public errors omit SDK messages, stacks, partial text and model identifiers.

Profile, user input, model handoffs and external findings are untrusted data. Prompt rules cannot guarantee semantic immunity to every injection; enforced schemas, fixed provider/model/tool allowlists, consent gates and absence of arbitrary execution limit its authority. Source links reject unsafe schemes, credentials, excessive length, duplicates and low-quality domains, and prioritize high-signal domains. Raw provider HTML is never forwarded.

## Verified API contracts and account probe (2026-10-25)

Official model pages establish [`gpt-6-luna`](https://developers.openai.com/api/docs/models/gpt-6-luna), [`gpt-6.1-sol`](https://developers.openai.com/api/docs/models/gpt-6.1-sol), and [`gemini-3.8-flash`](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash). Sol low/medium/high and Gemini HIGH are supported. OpenAI tools use Responses, with `store:false`. No deprecated Gemini sampling parameters are sent. Combining Google Search with structured output is documented as [preview for Gemini 3/4](https://ai.google.dev/gemini-api/docs/generate-content/structured-output); a bounded simple live Search + HIGH thinking + JSON Schema probe succeeded with three provider sources. The full nested final-strategy JSON Schema was subsequently rejected by Vertex streaming with HTTP 400. Build therefore uses the existing verified `formatGeminiResponseSchema` adapter and `responseSchema` transport dialect. Complete strict Zod validation, including every length/cardinality/unknown-field guard, remains mandatory before publication or persistence.

Read-only model metadata calls confirmed access to Luna and Sol. The initial Gemini HTTP 401 came from a model metadata GET operation that Express Mode does not support; it was incorrectly classified as an authentication problem. The same configured Express key successfully completed an actual `generateContent` request against `gemini-3.8-flash`. No credential was changed or disclosed. Express supports generation, streaming and token counting; see the [official Express REST reference](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/express-mode/api-reference).

Use `node scripts/check-gemini.js` for a bounded basic real connection check; it does not certify every structured streaming schema or available capacity for long generation. It sends only a synthetic “OK” prompt through the existing SDK provider policy and prints a sanitized success/error record, never API keys, provider output, stack traces or account details. With configured Redis, provider reservations use the existing shared budget/slot ledger. No health/debug API route was added.

Live synthetic probes subsequently confirmed:

- Direct Gemini `generateContent`: nonempty response, `STOP` completion, six reported tokens.
- The reusable connection diagnostic: `ok:true`, approximately 1.35s for that single run.
- Small Build with actual providers: Luna → Gemini, valid three-section strategy, streamed output, approximately 18.7s for that single run.
- Complex Build with actual providers: Luna → Gemini → Sol, valid three-section strategy with technical actions and measurable KPIs, streamed output, approximately 57.5s for that single run.
- Search + HIGH thinking + JSON Schema in a direct Gemini probe: valid JSON, `STOP` completion and three provider source chunks.
- Full Build with an external-evidence request after switching to `responseJsonSchema`: Luna → Gemini → Sol completed in approximately 127.2s. That run returned zero accepted source links and labeled the plan around missing evidence. It confirms synthesis/streaming, but is not evidence of successful grounding in that full run. Source chips are not fabricated when provider sources are absent.

The earlier full search run using the legacy `responseSchema` field hit the 120s Gemini stage deadline. The full nested streaming schema now uses the existing Vertex `responseSchema` adapter. Those application deadline failures were historical; Build no longer schedules them, and only a provider-reported timeout can produce `AI_TIMEOUT`. A single successful run does not establish that schema choice caused every latency difference.

These are synthetic single-run observations, not production latency guarantees or a comprehensive quality benchmark. No user profile was sent, and no strategy was persisted during these standalone live probes. Local regression tests use controlled provider responses.

## Validation

Run with Node 24 (the repository's declared runtime):

```
npm run check
npm test
```

`test/build-orchestrator.test.js` covers stage counts, reasoning, consent/minimization, search grants, source provenance, malformed output, aborts, waiting without time cutoffs, reservations/releases and revoked authorization. `test/build-http.test.js` exercises the actual services, HTTP/SSE, privacy/AI policy, execution guard and tenant repository with protected provider fixtures. Existing storage/concurrency fixtures include the new Luna route and explicit Gemini completion metadata. The HTTP concurrency assertion now requires `EXECUTION_BUSY` for overlapping generation, preserving the mandatory tenant mutex.

Final validation on Node v24.22.1 after provider recovery: `npm run check` passed (191 JavaScript modules); `npm test` passed 698/698, including 46 orchestration/HTTP tests, three SDK deadline/cancellation isolation tests and five Gemini diagnostic tests. `git diff --check` passed. A scoped credential/bypass scan of the changed Build implementation and new fixtures found no credential material or execution bypasses.

## Incident reproduced on the supplied architecture brief

Before recovery was added, the exact AI-native SaaS architecture brief was classified as `complex/high` by Luna in about 2.2s. Gemini returned HTTP 429 after approximately 108.2s; the request ended as `AI_RATE_LIMITED` before Sol ran. This is a provider capacity/rate-limit response, not evidence that the API key is invalid. The old SSE message concealed that distinction. A separate live final-strategy stream probe reproduced Vertex HTTP 400 with the full `responseJsonSchema`; the existing Vertex `responseSchema` adapter completed the same probe in about 14.3s. Those are separate failures: capacity errors require recovery, while the incompatible transport schema required correction. The exact brief later completed through Gemini fallback after Sol timed out under the former deadline policy: about 252s total, eight sections and 24,740 streamed characters, with all strategy schema checks passing. Those are historical measurements from before the user instructed removal of elapsed-time model cutoffs; Build no longer forces that timeout or switches a healthy model merely because it is slow.

Provider failures now produce bounded structured diagnostics (random request ID, stage, model, normalized code/status, elapsed time and schema issue paths). No prompts, outputs, account IDs, SDK messages or credentials are logged. Exhausted SSE errors include a safe actionable message, retryability and request ID. No health/debug route or dependency was added.

The no-deadline SDK adapter was also checked with real synthetic OpenAI and Gemini calls; both returned successfully. This basic transport check does not reclassify the earlier deadline-limited full-brief run as an unlimited run.

No production deployment was performed.

### Preparation estimate card

`POST /api/strategy/estimate` accepts only `{brief}` (8–8000 trimmed characters). It invokes the mandatory Luna classifier with no search tools or profile data and returns numeric minutes only. It uses the existing privacy/auth policy, provider budget reservations, shared owner execution mutex/background-job exclusion, client disconnect cancellation and a separate 20-per-10-minute preview rate limit. Unknown fields and invalid idempotency headers are rejected; canonical payload fingerprints reject reused keys with different input (409). Preview calls do not consume guest message or brief allowance.

Validated routing decisions are held in a bounded 512-entry, five-minute cache keyed by SHA-256 of owner and canonical task context. Only routing decisions are cached; raw prompts/profiles are not retained. Authorization is checked again on cache hits. Assessment reuses the preview route when task context is unchanged; added clarification answers or assumptions cause a fresh decision. Idempotency fingerprint retention is bounded to 512 entries/15 minutes. Both caches are process-local optimizations, not durable cross-replica result storage.

Server-owned base minute ranges: small 1–2; medium low 2–3, medium 2–4, high 3–5; complex 4–8. An authorized search grant adds 1 to the lower and 2 to the base upper bound. The upper bound then receives exactly 2 extra minutes for small tasks or 3 for other tasks. These are conservative heuristic estimates, not measured completion promises or execution deadlines.

The UI debounces typing for 1.2 seconds and spaces preview starts at least 10 seconds apart. Editing cancels stale requests and suppresses stale responses. It safely renders validated numeric ranges with textContent, uses a polite live status, shows a neutral unavailable state on failure, and sends no profile information. Placement: desktop below the input, mobile immediately above it, and on the analysis/generation screen. Final-stage SSE metadata updates the estimate if routing changes after clarification. No model names, countdown or new generation timeouts are introduced.

Validation: automated coverage includes strict request validation, Luna-only calls, tenant isolation/cache reuse, idempotency conflict, background-job exclusion, guest quota preservation, numeric rendering and stale-response cancellation. Browser checks against the local server confirmed a real Luna estimate (2–7 minutes), desktop input-below placement at 1280px, mobile input-above placement at 390px without horizontal overflow, and the analysis loading card. Production deployment was not performed.
