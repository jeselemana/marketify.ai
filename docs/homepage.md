# Marketify v3.0 public homepage

## Routes and shared code

- `/` serves `public/home.html`. `/workspace` uses the existing application. Authentication, legal and other workspace routes retain the existing fallback.
- `public/tokens.css` contains the original shared design tokens. The workspace imports them through `style.css`; the homepage loads only the tokens and its own scoped stylesheet.
- `public/prompt-composer.js` shares validation, resizing, IME-safe keyboard handling and duplicate-submit prevention with the existing Build composer.
- Both homepage composers call `startWorkspaceIntent`. The exact prompt and mode stay in tab-scoped session storage. Only a random intent ID appears in the return URL. Intents expire after 24 hours and are consumed once before dispatch.
- `/api/auth/me` decides whether to enter the workspace or the existing login flow. Auth links retain `returnTo` through signup, verification, password recovery and reloads. On completion, the workspace loads context and calls the existing `startAssessment` or `submitAskMessage`; model selection and backend processing are unchanged.
- Explicit guest access restores the text without automatically dispatching the authenticated intent. Failed requests retain the existing workspace retry/error interface. If authentication expires during initial dispatch, the pending intent is restored for sign-in.
- Footer mode links use `/workspace?mode=ask` or `?mode=build`; usage information uses `/workspace?view=limits`. No paid tiers or prices were invented.

A running Express process must be restarted to pick up the new `/` server route. Static-file changes are served immediately, so `/home.html` also previews the homepage on an already-running server.

## Product previews

`public/previews/` contains optimized WebP captures of the **actual workspace renderers**, at 1200×760 and 390×640. They use synthetic coffee-shop sample content and are labelled as examples on the homepage. They contain no customer data or claimed performance results. Desktop and phone captures are separate, so the phone preview does not shrink an unreadable desktop image.

The sample content is in `dev/homepage-fixture.mjs`. To reproduce captures, run:

```sh
node dev/homepage-preview-server.mjs
```

This loopback-only test server runs on port 5052 with mock authentication and AI responses. It does not read `.env`, call model services or change application data. It is **not** the production application and must not be deployed. Its local-only login is `homepage-demo` / `local-test-only`.

Use the real UI to open the sample strategy, switch to Ask and select that strategy as context, or open Arxiv. Capture each desktop/mobile view and encode as WebP. The fixture is validated against the production strategy schema in tests.

## Verification

- `npm run build`: syntax checks including all new modules.
- `npm test`: 70 tests, including prompt fidelity, intent expiry, one-shot consumption, authenticated/guest routing, failures, keyboard behavior, and the actual Express routing with an isolated data directory and no model credentials.
- Browser checks: Ask handoff through login → signup → reload → login; exact whitespace/line breaks reaching the Ask request; authenticated Build reaching assessment; final composer dispatch; reload without resubmission; example population and mode selection; mobile menu/Escape; keyboard preview tabs; single-open FAQ.
- Responsive overflow and first-viewport composer checks at widths 320, 360, 390, 768, 1024 and 1440.
- AI responses and auth endpoints were mocked for UI workflow checks. Live Google authentication, email delivery and paid model generation were not exercised. Existing backend tests passed.
