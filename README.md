# stocks-rank

A stock scanner for the **S&P 500 and Nasdaq-100** (518 stocks). Pick a stock and
you get a radar chart (one spoke per metric, so a stock's scores draw its shape)
plus a statistics table with the figures behind each score. Metrics 1–7 come from
market data. Metrics 8–13 are judgement calls that **Claude** scores after
researching the company on the web.

Each of the 13 metrics scores **0, 5 or 10**, for a maximum of **130**.

| # | Metric | 0 | 5 | 10 | Source |
| - | --- | --- | --- | --- | --- |
| 1 | Cash > Debt | debt ≥ cash | cash > debt | cash ≥ 2× debt | Yahoo `financialData` |
| 2 | Revenue growth | < 10% | 10% – 20% | ≥ 20% | annual income statements |
| 3 | Operating margin | < 10% | 10% – 25% | ≥ 25% | Yahoo `financialData` (TTM) |
| 4 | Short interest (% of float) | ≥ 10% | 5% – 10% | < 5% | Yahoo `defaultKeyStatistics` |
| 5 | Institutional ownership | < 30% | 30% – 60% | > 60% | Yahoo `defaultKeyStatistics` |
| 6 | Scalability | expenses grew as fast or faster | — | revenue grew faster than expenses | annual income statements |
| 7 | Share price, 5 years vs S&P 500 | < 10 pts ahead | 10 – 20 pts ahead | ≥ 20 pts ahead | monthly adjusted closes vs SPY |
| 8 | Moat | little or none | real but contestable | wide and durable | **Claude** |
| 9 | CEO | poor record or turmoil | competent or unproven | proven and exceptional | **Claude** |
| 10 | Recession proof | highly cyclical | moderately cyclical | resilient | **Claude** |
| 11 | Secular trend | structural decline | neutral or mixed | strong tailwind | **Claude** |
| 12 | Culture / mission | toxic or scandal-ridden | unremarkable | strong and distinctive | **Claude** |
| 13 | Talent | can't hire or retain | average | destination employer | **Claude** |

A metric with no data shows **n/a**. It doesn't count as 0, and the total says
how many metrics were scored.

### Interpretation choices

These are the places where the spec left room for interpretation:

- **Boundaries.** A value on a boundary goes to the higher tier for "X%+" rules
  (revenue growth of exactly 20% scores 10). "Above 60%" institutional ownership
  is strict, so exactly 60% scores 5. Cash equal to debt scores 0 because cash
  isn't *larger*.
- **Metric 7** compares 5-year returns in **percentage points**: stock +80% vs
  S&P 500 +65% is 15 pts ahead, so it scores 5. The spec gives no score for being
  0–10 pts ahead, so that range scores **0**, the same as trailing the index.
  Both returns use dividend-adjusted prices, with SPY standing in for the S&P 500.
  A stock with less than 5 years of history (a recent IPO) is n/a.
- **Revenue growth & scalability** compare the last two reported fiscal years, so
  both metrics use the same period. Expenses are `totalExpenses`, or revenue minus
  operating income when that isn't reported. If annual statements are missing,
  revenue growth falls back to Yahoo's latest-quarter YoY figure and scalability
  is n/a.

## How Claude scores metrics 8–13

On a stock's page you're asked for **your own Claude API key**. Then, in your
browser, Claude Opus 5.5 (`claude-opus-5-5`) gets the rubric above. It checks
recent facts with web search (the current CEO, leadership changes, layoffs,
scandals), then answers by calling a strict `submit_scores` tool. The app
validates the answer: every metric must be present, and each score must be
exactly 0, 5 or 10. The page shows a rationale per metric, Claude's summary,
and the sources it relied on. Only http(s) URLs that its searches actually
returned are listed.

**Where your key goes.** The browser calls `api.anthropic.com` directly. The key
is never sent to the stocks-rank server, and the server has no code path that
could receive it.

- **Storage:** the key is kept in `sessionStorage` (until the tab closes), or in
  `localStorage` if you tick *Remember on this device*. *Forget key* removes it
  from both.
- **Content Security Policy:** the page may only connect to itself and
  `api.anthropic.com` (`next.config.ts`), so an injected script couldn't send
  the key elsewhere. Model output is rendered as text, never as HTML.
- **Residual risk:** a key in a web page can still be read by anything that runs
  in that page or browser, such as a malicious extension, or by someone with
  access to the device if you chose *Remember*. Use a key you can revoke, and
  set a spend limit on it in the Claude Console.

**Caching and cost.** Each analysis is saved in your browser for one week per
stock. The page shows when it expires, and *Refresh now* throws it away and runs
a new analysis. After a week it is redone automatically on the next visit. An analysis is one Opus 5.5 conversation at
`high` effort with up to 6 web searches, billed to your key. Web search must be
enabled for your organization in the Claude Console. If a safety classifier
declines, the request falls back server-side to Anthropic's recommended model
(`fallbacks: "default"`), and the page names the model that answered. After
changing the prompt, bump `ANALYSIS_VERSION` in `src/features/analysis/prompt.ts` so
cached analyses are redone.

## Installing it (PWA)

stocks-rank is an installable Progressive Web App:

- **Desktop Chrome or Edge:** use the *Install app* button in the header, or the
  install icon in the address bar.
- **Android:** browser menu → *Install app* / *Add to Home screen*.
- **iPhone and iPad:** Safari → Share → *Add to Home Screen*.

The service worker (`public/sw.js`) loads pages network-first. The last 50
pages you opened stay available offline, showing their market data's "as of"
time and Claude's saved scores, and an *Offline* badge appears in the header.
Pages you haven't opened show an offline notice. Build assets are cached by
their hashed names. `/api/*` and every other origin, including
`api.anthropic.com`, are never intercepted or cached.

The site is behind Vercel's login, so the manifest link is sent with
credentials (`crossorigin="use-credentials"`). Without that, the browser can't
read it and installing fails. Icons are in `public/icons/` (rendered from the
SVGs there), plus `src/app/icon.svg` and `src/app/apple-icon.png`.

### Updates

Pages load network-first, so an installed app picks up a new deploy the next
time it opens online. For a window left open across a deploy, each build bakes
in an id (Vercel's deployment id, or the git commit locally) that
`/api/version` also reports. The app re-checks when it returns to the
foreground, comes back online, or every 15 minutes, and shows *New version
available · Reload* when the ids differ. Reload waits while Claude is
mid-analysis, so a paid run isn't thrown away. The same id is Next.js's
`deploymentId`, so a client-side navigation across a deploy also does a full
reload. Bump `VERSION` in `public/sw.js` when changing what the service worker
caches.

## Running it

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:3000, live Yahoo Finance data; enter your Claude key in the page
npm run dev:demo     # offline: deterministic fake data and scores, clearly labelled
npm run check        # lint + typecheck + unit tests
npm run universe     # refresh the S&P 500 / Nasdaq-100 list (src/data/universe.json)
```

Market data comes from Yahoo Finance via [`yahoo-finance2`](https://github.com/gadicc/yahoo-finance2).
No API key is needed. The data is unofficial and delayed, so treat it as a
screening aid and not as investment advice. Responses are cached for about an
hour per stock.

`GET /api/stock/:symbol` returns metrics 1–7 as JSON. Claude's scores run in the
browser and aren't part of it.

## Architecture

The code is split by feature. Routes in `src/app/` only compose features.
Features hold their own logic, components and styles. `src/ui/` is a small
design system that knows nothing about stocks.

```
src/app/                       routes: / · /stock/[symbol] · /offline · /api/stock/[symbol] · /api/version
src/features/
  scoring/                     metric catalogue, thresholds and pure scoring rules (the spec lives here)
  market-data/                 fundamentals type + pure derivations; yahoo.ts does the I/O; report.ts caches (server only)
  universe/                    S&P 500 ∪ Nasdaq-100 list, search, and the StockPicker
  analysis/                    Claude scoring: prompt + tool schema (prompt.ts), API loop (claude.ts),
                               browser key + cache (browser-store.ts), hook and status/summary components
  scorecard/                   model.ts turns data + scores into rows, meters, totals and callouts (pure, tested);
                               presenters.ts says how each market metric is shown; components/ render it
  radar/                       radar geometry (pure, tested), the animated RadarChart, and the RadarGlyph mark
  pwa/                         service-worker registration, install/offline controls, the update notice
src/ui/                        Panel, Button, Callout, ScorePill, Meter, Gauge, TierBar, Skeleton, Icon, motion
src/styles/                    tokens.css (colours, type, radii for light and dark) and base.css
public/sw.js                   service worker; public/manifest.webmanifest + public/icons/
scripts/build-universe.mjs     regenerates src/features/universe/data/universe.json
```

Rules, enforced by ESLint: `src/ui/` must not import features, and features
must not import routes. Each component keeps its styles in a sibling
`.module.css` and reads colours only from the tokens.

**Adding a metric:** add it to `METRICS` and its rule to `score.ts` in
`features/scoring/`. For a market-data metric, also add an entry in
`features/scorecard/presenters.ts` (figure, meter, takeaway). For a judgement
call, add it to the prompt in `features/analysis/prompt.ts` and bump
`ANALYSIS_VERSION`. The radar, tables, totals and callouts pick it up from
there.

To change a threshold, edit `THRESHOLDS` in `src/features/scoring/score.ts`.
The scores and the meters both read it, and `score.test.ts` pins every boundary.
