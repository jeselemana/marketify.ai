# Ask capabilities and artifacts (V4)

Ask now supports `@Word`, `@Excel`, `@PowerPoint`, `@PDF` and `@Web` through a server-owned plugin registry. The existing Express application, Ask model routing, session/origin security, Build context, chat persistence and SSE transport remain in use.

## Using it

Type `@` in the Ask or Strategy Copilot composer, filter the list, and choose with the mouse or Arrow keys + Enter/Tab. Selected capabilities appear as removable chips. Escape closes the list. Multiple chips are supported; research runs before selected artifact generators. An explicit selection takes precedence over inferred phrases such as “Bunu Excel faylı kimi hazırla”.

Select a saved Build strategy or planner task using the existing context picker, then request an artifact. The server resolves that context under the signed-in owner. Follow-up references use the current saved conversation and latest published artifact. References to sheets, slides, Word or PDF narrow the target; the card's **Edit** action selects a specific artifact explicitly. Historical versions can be previewed/downloaded, while edits apply to the latest version.

Cards expose **Preview**, **Download** and **Edit**. Preview is a safe structural view of the artifact specification (including formulas, cached results, chart data and speaker notes), rather than a pixel-exact Office application preview. Download provides the actual DOCX/XLSX/PPTX/PDF through an authenticated endpoint. Generation shows real execution phases without estimated percentages. Failed runs retain the saved user request and expose Retry without publishing partial files.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `src/services/plugins/registry.js` | Metadata, availability, execution handlers, permissions and intent/reference patterns |
| `src/http/capability-router.js` | Strict requests, owner-scoped chat/Build/task resolution, SSE and publication |
| `src/services/plugins/workflow.js` | Sequential bounded execution, structured state, model routing, one validation repair and edit operations |
| `src/services/plugins/research.js` | Grounded Gemini research and OpenAI web-search fallback |
| `src/services/artifacts/schemas.js` | Bounded specifications, allowed spreadsheet formulas and structural edits |
| `src/services/artifacts/render*.js` | Deterministic native files, worker isolation and integrity validation |
| `src/services/artifacts/upload-context.js` | MIME/signature validation and bounded Office text extraction |
| `src/repositories/artifact-repository.js` | Immutable binaries, manifests, checksums, version conflicts and cleanup |
| `public/artifacts.js`, `public/artifacts.css` | Registry-driven selector, chips, native cards and version previews |

The pipeline is context resolution → intent/plugin routing → structured model output → validated specification → deterministic renderer → private storage → saved chat artifact. The model supplies data, never renderer code or binary content.

DOCX supports headings, paragraphs, numbered/bullet lists, tables, citations, headers/footers and page breaks. PDF uses an embedded licensed Noto Sans font, controlled pagination, repeated table headings and page numbers. PPTX contains editable text, tables, charts, key metrics and notes. XLSX supports multiple sheets, real formulas with optional cached numeric results, number formats, tables, conditional formatting and native OOXML charts. Chart series reference matching worksheet cells when available. Formula recalculation happens in the spreadsheet application on opening; Helmer does not execute an Excel calculation engine, so model-provided cached values are not an independent financial validation.

## Extending the registry

Register a trusted server-side descriptor with `id`, `name`, `icon`, `description`, `capabilities`, `acceptedInputs`, `outputTypes`, `permissionRequirements`, `availability()` and `execute(context)`. Optional `descriptionEn`, `outputLabel`, `intentPattern` and `referencePattern` customize display and inference. The registry API computes the current `status`; no Ask UI/router switch needs another connector name.

`execute` receives the request, prior structured outputs, an abort signal and restricted helpers. Context is supplied only to a plugin declaring `context:read`; research and artifact helpers also verify the plugin's declared scopes. Every output must match a declared output type and fit the output size bound. Outputs feed later steps and each execution records step status, timestamps, research results or artifact/version references. File generator descriptors additionally provide schemas, MIME type and extension, backed by an approved renderer/storage format.

The current server grants only `context:read`, `artifacts:write` and `web:search`. A future Drive/Gmail/Calendar/Slack/Notion handler must implement its real connector, account authorization and owner-specific scope grant before it can execute. Client-provided permission claims are never accepted. Arbitrary plugin code cannot be uploaded or run by a model. This release provides bounded sequential orchestration, including Web → artifact and artifact → artifact; automatic model-planned connector loops are not enabled.

## API

- `GET /api/ask/plugins`: authenticated metadata/availability.
- `POST /api/ask`: existing Ask payload plus optional `pluginIds: string[]` and `artifactId: UUID`. `chatId`, `strategyId`, `taskId` and `stream` keep their existing roles. Without a capability intent, execution continues through ordinary Ask.
- SSE phases contain `status`, `statusText` and the allocated `chatId`; the final committed response includes `done`, `reply`, `artifacts`, `execution`, `chat` and optional `groundingMetadata`.
- `GET /api/artifacts/:id/versions/:version/preview`: published specification and accessible version history.
- `GET /api/artifacts/:id/versions/:version/download`: private validated binary attachment.

Artifact IDs alone grant no access. Both the manifest owner and matching published chat version must be present. Unknown/malformed requests fail validation; provider internals never become a chat error message.

## Storage and deployment

Install with `npm ci` and start using the existing configuration. At least one existing AI provider must be configured. Artifact creation reuses Ask routes and provider fallback. Web requires an actually executed search and safe source URLs; it uses configured Gemini grounding, with OpenAI Responses `web_search` as fallback. Configure `GOOGLE_CLOUD_LOCATION` for Vertex when needed; the default is `global`. Vertex credentials must have prediction permissions for the configured project. Local verification observed an IAM 403 for the existing Gemini credential, while the OpenAI fallback successfully completed research and artifact creation.

Artifacts are written below `DATA_DIR/artifacts` on an atomic private filesystem with owner-hashed keys. When existing R2 configuration is complete, manifests/binaries are also stored using private R2 objects and reads fail closed through R2. Never expose this directory or the artifact bucket as public static content. Retain a writable persistent `DATA_DIR`, protect it with backups, and include the artifact objects/manifests when restoring chats. Chat/account deletion removes associated generated files. Uploaded file context continues to use the existing owner-scoped, expiring cache; an expired attachment must be attached again.

Configure Redis for cross-process owner execution locks and artifact version locks. The inherited JSON chat/user repositories remain intended for a single application writer; adding Redis or R2 does not turn those stores into a transactional multi-writer database. Use a database-backed repository before scaling independent writers. There is no automatic artifact retention purge; immutable versions are kept until chat/account deletion.

Bounds: six capability steps, 180-second workflow deadline, one schema repair, 30-second renderer worker deadline with 256 MB worker memory, four simultaneous Ask runs per process and one per owner, 25 MB rendered files, 1.5 MB specifications, 100 versions per artifact and 20 MB history manifests. Office uploads allow 20 MB compressed and 30 MB decompressed content, with at most 1,500 entries. Schemas further bound sheets, rows, slides, sections and chart series.

## Security and recovery

Strict Zod input/specification validation, safe extension/MIME pairs, sanitized names, fixed storage keys and owner-scoped download checks prevent arbitrary path selection. Spreadsheet formulas allow approved internal calculations, excluding external links, macros, DDE and executable functions. Renderers run in worker threads without evaluating model code. OOXML containers are checked for CRC, required parts and valid XML; PDFs are reopened and checked for pages; XLSX is reopened through ExcelJS. A SHA-256 checksum is verified again on download. These checks prove basic file integrity, not correctness of business advice or financial assumptions.

All selected artifact steps render before persistence. Failed persistence or chat publication rolls back newly saved tail versions. Unpublished versions cannot be previewed/downloaded. Stale version updates fail rather than overwrite prior versions. Cancellation propagates to provider calls and workers; late storage completion is rolled back.

## Verification

Run `npm run check` and `npm test`. Tests exercise real native binary rendering/reopening, formula/chart parts, authenticated HTTP downloads, owner isolation, Build context, immutable edits, SSE/retry, upload extraction, scope checks, timeouts, provider schema compatibility, grounded research fallback, rollback and registry-driven keyboard/mouse/XSS-safe UI behavior. Deterministic tests inject model/research responses; no production authentication bypass is introduced. Separate live smoke checks used the actual server, real provider credentials and temporary isolated data for all five capabilities and downloads.

Existing dependency audit findings in the inherited Express/qs, Nodemailer and `xlsx` packages remain outside this feature's dependency changes. Newly added renderer dependencies use package overrides for the vulnerable transitive `uuid` and `image-size` versions. Check `npm audit` as part of deployment maintenance.
