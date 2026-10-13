<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## stocks-rank

Read `README.md` first: it covers the metrics and their edge cases, how Claude
scores (and where the API key may and may not go), the PWA and update flow,
and the architecture.

- **Checks:** `npm run check` (lint, typecheck, unit tests) and `npm run build`
  before pushing. `npm run dev:demo` runs fully offline with labelled fake data.
- **Boundaries:** routes in `src/app/` compose features; `src/features/<name>/`
  own their logic, components and styles; `src/ui/` stays stock-agnostic. ESLint
  enforces the import rules. Keep pure logic (scoring, `scorecard/model.ts`,
  radar geometry) free of React and covered by tests.
- **Styling:** CSS modules next to each component; colours only from the
  tokens in `src/styles/tokens.css`, in both themes; respect reduced motion.
  Controls follow iOS conventions: reuse `Button`, `Menu`, `Sheet`/`ActionSheet`,
  `SegmentedControl`, `SwipeActions` and `Toast` from `src/ui/` before adding new ones.
- **Browser state** (the API key, Claude's cache, the watchlist) goes through
  `src/lib/browser-storage.ts`, keys prefixed `stocks-rank:`, read with
  `useSyncExternalStore`. Anything a swipe does must also be reachable by
  keyboard or mouse.
- **The API key never reaches the server.** Don't add a route that accepts it,
  and keep the CSP's `connect-src` to `'self'` and `api.anthropic.com`.
- **Version bumps:** `ANALYSIS_VERSION` in `features/analysis/prompt.ts` when
  the prompt changes; `VERSION` in `public/sw.js` when caching changes.
- **Keep the README in step** with any change to metrics, thresholds, the page,
  the watchlist, the Claude flow, the PWA, or the layout.

