# Themes

Light remains the default, regardless of the operating system preference. The sun/moon control is available in the workspace rail, mobile sidebar, homepage, sign-in screens, and admin page. The personalization page has no separate appearance card.

## Implementation

- `public/theme.js` runs synchronously before CSS in every HTML entry point. It restores `marketify_theme` from local storage onto the document's `data-theme` attribute, updates browser chrome and accessible control state, and synchronizes open tabs. Storage failures fall back safely to Light; switching still works in memory.
- `public/tokens.css` preserves the original Light tokens. The opt-in Dark block defines surfaces, text, semantic status colors, and shadows. The original blue brand fills remain unchanged. Dark surfaces use neutral graphite, softer borders and shadows, and a localized blue halo around the empty workspace composer (at the bottom on mobile).
- Existing hardcoded colors use semantic compatibility variables with the exact original values as fallbacks. These `--theme-*` variables are only defined in Dark, so the original Light cascade, geometry, and animations remain intact. New components should use the shared semantic tokens directly.
- `public/theme.css` styles only new switches and dark native controls, autofill, and text selection. Most component adaptation is in the original declarations, so dynamic content, pseudo-elements, responsive rules, menus, and animation keyframes inherit the theme naturally.
- Theme selection does not rerender application content, clear drafts, or submit account settings. Google Sign-In's own API updates its iframe theme.
- Product preview images, logos, exported documents, and the admin page's original default appearance are retained. The admin page was already dark; its opt-in Dark palette now uses the shared colors.

## Verification

Follow-up adjustment: the shared Build/Ask composer now uses 32px corners in both themes, including mobile, as requested. Its radius is defined once in the base component; theme rules only change its colors and shadows.

Run `npm run check` and `npm test`. Theme tests cover first-paint restoration, default/invalid values, both persisted choices, unavailable storage, cross-tab updates, dynamic controls, disabled controls, entry-point loading order, token completeness, and 4.5:1 contrast for dark text tokens against the main surfaces.

For browser checks, run `node dev/homepage-preview-server.mjs` and open `http://127.0.0.1:5052/`. This existing local fixture server makes no model calls and does not use real account data. `/__theme-mobile` embeds the actual workspace and homepage at 390px and sign-in at 320px.

Verified during implementation:

- 74 tests pass; syntax checks and `git diff --check` pass.
- All original stylesheet rules resolve to their exact Light values after substituting compatibility fallbacks. The desktop homepage screenshot matched the baseline pixel-for-pixel outside the added switch area.
- Dark workspace/homepage, archive cards and menus, strategy documents and refinement/export popovers, planner, usage, settings, legal forms, authentication, admin, and mobile layouts were inspected.
- Reload and cross-tab persistence were checked; changing the theme preserved the open refinement popover and its unsent draft.

The original brand fill with white text is preserved, including its existing contrast characteristics; the semantic text-token contrast test is not a claim of full application WCAG certification.
