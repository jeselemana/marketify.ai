# Marketify AI

Marketify AI is an AI strategy workspace built on the project's existing Express and vanilla JavaScript stack. It turns a business brief into a structured strategy, selectively asks for clarification, supports versioned refinements, saves work to an owner-scoped MVP repository, and exports strategy content locally.

## Run locally

1. Copy `.env.example` to `.env` and add `OPENAI_API_KEY`.
2. Install dependencies with `npm install`.
3. Start with `npm start`.
4. Open `http://localhost:5050`.

## Configuration

- `OPENAI_API_KEY` — required for assessment, generation, and refinement.
- `OPENAI_FAST_MODEL` — intake/clarification model; defaults to `gpt-5.6-terra`.
- `OPENAI_STRATEGY_MODEL` — generation/refinement model; defaults to `gpt-5.6-terra`.
- `OPENAI_ASK_MODEL` — optional server-only model override for Ask mode.
- `MAX_CLARIFICATION_ROUNDS` — defaults to `2`.
- `PORT` — defaults to `5050`.
- `REDIS_URL` — optional and used only by the preserved legacy analytics chat endpoint.

## Data and ownership

The current MVP stores saved strategies in `data/strategies.json`, isolated behind `FileStrategyRepository`. Access is scoped to a random, HTTP-only guest cookie. This preserves ownership between visits on the same browser but is not a replacement for production authentication or a transactional database.

## Export status

- HTML document export: implemented locally.
- CSV spreadsheet export: implemented locally with normalized priority, action-plan, KPI, and risk rows.
- Google Docs, Google Sheets, and connected Excel: visibly marked as coming soon; no connection is faked.

## Verification

- `npm run check` — JavaScript syntax checks.
- `npm test` — domain, refinement-context, versioning, and ownership tests.
- `npm run build` — complete static-app validation (`check` + `test`).
