# v4.0 production hardening verification

The seven findings from the production-readiness audit have been remediated.

| Finding | Implemented control |
| --- | --- |
| Deleted users resurrected by sync | User and auth sync read the configured authority without merging stale local records. Read outages propagate; revoked sessions and consumed tokens are not restored. |
| Refinement ignored model-improvement opt-out | Saved refinement passes the privacy flags to tracking and skips content iteration logging. The learning service also rejects restricted-parent iterations. |
| Pre-lock idempotency race | Generation rechecks authoritative storage after acquiring the execution lease. Unsaved results replay for 15 minutes across instances. Storage failures propagate instead of reporting a successful save. |
| Learning concurrent write loss | Learning and telemetry use a shared atomic JSON store: filesystem locking locally, ETag CAS and retries on R2. Redis is a mirror, not the authority. |
| Active locks reclaimed by age | Local locks check owner process liveness and refresh the opened lock inode. Redis/R2 execution leases renew and abort work on loss. Lease ownership is checked before model execution and persistence. |
| Telemetry permanently stopped after one error | Each mutation acquires an independent recoverable lock; a rejected updater cannot poison later writes. |
| Corrupt shard overwritten | Strategy, chat and planner reject corrupt JSON/structures with STORAGE_CORRUPT and retain the original file. |

Additional controls: create-only atomic initialization, unique temporary files, refinement version deduplication, early-disconnect abort handling, and complete JavaScript syntax coverage. Existing Zod, HMAC, tenant isolation, HTTPS/HTTP grounding filters and SSE checks remain covered by the suite.

## Verification

- `npm run check`: passed; 140 JavaScript modules checked, artifact checks passed.
- `npm test`: 464 passed; 0 failed, 0 skipped, 0 cancelled.
- `test/v4-production-hardening.test.js`: 18 regression tests covering the fixes.
- HTTP tests ran with local ports permitted. R2 and Redis protocol tests use deterministic adapters, and AI responses are mocked.

## Runtime behavior and deployment scope

Configured R2 outages fail closed for authoritative identity/storage reads. Redis outages cannot cause stale local writes. Local-only mode coordinates processes sharing a filesystem; configured R2 coordinates independent replicas even without Redis.

Idempotency replay without auto-save has a 15-minute logical expiry. Redis removes the cached content at TTL expiry. Local/R2 result objects are ignored after expiry; physical retention of R2 objects under `data/strategy-results-v1/` and `data/strategy-locks-v1/` should be managed by the bucket lifecycle policy.

No production deployment or live R2/Redis/AI smoke test was performed. The verification establishes repository behavior and protocol handling, not live credentials, bucket policies or provider availability.
