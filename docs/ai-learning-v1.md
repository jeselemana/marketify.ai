# AI Learning Loop v1

## Architecture

The learning loop is additive and does not change Ask/Build prompts, routing, personalization, or provider selection. `LearningLoopService` owns scoring, sanitization, candidates, aggregation, and export. `FileAiLearningRepository` follows Helmer's current file + optional Redis/R2 storage pattern.

The store is `data/ai-learning-v1.json` with `schemaVersion: 1` and four logically separated collections:

- `interactions`: raw production AI request/response telemetry;
- `signals`: explicit and measurable behavior only;
- `iterations`: Build refinement lineage and preferred-response history;
- `candidates`: sanitized, review-gated training material.

Logging is fail-open. Callers do not await persistence and log failures separately, so telemetry cannot turn a valid Ask/Build response into a user-facing failure.

## Scoring and candidate creation

Weights and `AI_LEARNING_CANDIDATE_THRESHOLD` are environment-configurable. The default score starts at a neutral `0.5`. Explicit positive/negative ratings have strong weights; copy is intentionally weak; continued conversation has no positive score. Each stored score includes its explainable breakdown.

A successful interaction becomes a pending candidate only after the threshold is reached. Input and the latest preferred output are sanitized before candidate creation. Raw data is never automatically approved. Only an admin can move a candidate to `approved`.

## Privacy

Candidate sanitization detects and redacts common email, phone, bearer/access tokens, API keys, credentials, payment cards, and Azerbaijan FIN patterns. Relevant context uses an allowlist and does not duplicate personalization content. Account deletion cascades to interactions, signals, iterations, and candidates.

## Cost configuration

Set the four `OPENAI_*_USD_PER_1M` variables in `.env` from the provider pricing applicable to the deployment. When prices are missing, `estimatedCost` is `null`; the system does not invent cost. Each priced interaction stores its pricing snapshot, so later configuration changes do not rewrite historical costs.

## Migration and rollback

No existing data file or schema is mutated. On first write, the v1 store is created automatically. Back up `data/ai-learning-v1.json` before deployment if a pre-existing file exists.

Rollback code by reverting the Learning Loop changes. The additive `data/ai-learning-v1.json` file can be retained for a later redeploy or moved to an archive. Removing it deletes learning-loop data only and does not affect users, chats, strategies, planner data, or authentication. The Redis key is `marketify:store:ai-learning:v1`; the R2 object is `data/ai-learning-v1.json`.

## Admin API

All routes below are mounted behind both `requireAuth` and the existing environment-based admin authorization:

- `GET /admin/api/ai-learning/overview`
- `GET /admin/api/ai-learning/growth`
- `GET /admin/api/ai-learning/models`
- `GET /admin/api/ai-learning/tasks`
- `GET /admin/api/ai-learning/interactions`
- `GET /admin/api/ai-learning/interactions/:id`
- `GET /admin/api/ai-learning/candidates`
- `GET /admin/api/ai-learning/candidates/:id`
- `POST /admin/api/ai-learning/candidates/:id/review`
- `GET /admin/api/ai-learning/export`

Filtering and pagination occur server-side. Export currently supports modular format name `openai-chat-jsonl` and includes approved candidates only.
