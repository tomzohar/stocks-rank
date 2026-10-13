# stocks-rank

A stock scanner for the **S&P 500 and Nasdaq-100** (518 stocks). Pick a stock and
you get a radar chart (one spoke per metric, so a stock's scores draw its shape),
a score summary, callouts on what stands out, and every metric with the figure
behind its score. Metrics 1–7 come from market data. Metrics 8–13 are judgement
calls that **Claude** scores after researching the company on the web. Keep
the stocks you follow on a **watchlist** to compare them at a glance, and use
the **DCA Chart** tab to see what a simple dollar-cost-averaging system says
to do today.

Live at https://stocks-rank.vercel.app (behind Vercel's login).

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

## The stock page

Two tabs, each with its own URL: **Scorecard** (`/stock/AAPL`, described
below) and **DCA Chart** (`/stock/AAPL/chart`, see the next section).

- **Radar chart:** one spoke per metric; the vertex sits at the centre for 0,
  halfway for 5, at the edge for 10, coloured by score. Arcs round the outside
  mark the market-data and Claude groups. Hover, tap or tab to a spoke for a
  tooltip with its figure and the rubric line it earned. It highlights the
  matching metric row, and the other way round. The shape grows in on load
  and reshapes as Claude's scores arrive; a sweep runs while Claude is scoring.
- **Total score:** a dial out of 130, a grade (Strong ≥ 70%, Mixed ≥ 40%,
  otherwise Weak, over the metrics that have a score), points for each group,
  and how many metrics landed on 10, 5 and 0.
- **What stands out:** each metric that scored 10 (strengths) or 0
  (watch-outs), as a one-line takeaway such as "Cash covers debt 3.0× over".
- **The numbers (1–7):** each figure with a meter showing where it sits
  against the scoring cut-offs.
- **The judgement calls (8–13):** Claude's score and reasoning per metric, its
  summary, sources, and the cache and key controls.

The look is set by the design tokens in `src/styles/tokens.css`: light and
dark themes that follow the system, Geist and Geist Mono (self-hosted), and the
status colours green, amber and red, always shown alongside the number. All
animation is switched off for people who set their system to reduce motion.
Buttons, menus and sheets follow iOS conventions so the installed app feels
native: filled, gray, tinted and plain buttons that dim when pressed, a
segmented control for the index filter, pull-down menus, bottom sheets, action
sheets for destructive choices, and a tab bar on phones.

## The DCA chart

A rules check for dollar-cost averaging. It applies four rules to the latest
daily close:

| # | When | Then |
|---|------|------|
| 1 | Up 50% on your average buy price | Trim 10% of the position |
| 2 | Up 100% on your average buy price | Trim 20% of the position |
| 3 | 20% or more under the 52-week high | Make the next buy 2× |
| 4 | Up 20% or more over the past month | Make the next buy 0.5× |

- **Today's call** leads with the action, then each rule with whether it fires,
  the reading behind it and the price where it would. A trim outranks a buy
  call, and the next buy's size is shown beside it. Rules 3 and 4 multiply when
  both fire (2 × 0.5 = 1×).
- **Your average buy price** is needed for rules 1 and 2; without it they say
  so and only 3 and 4 run. It is saved per stock on this device
  (`localStorage`) and never sent anywhere.
- **The chart** is [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/):
  candles or a line, daily or monthly candles, over 6 months to 5 years. Drag,
  pinch and scroll to explore. It draws the double-down line (20% under the
  trailing 52-week high) as a dashed guide, and price lines for the 52-week
  high, the 0.5× threshold, and, with your price, your average and both trim
  levels. Markers sit on the key points.
- **Key points** list, for the chosen range, the 52-week high, each fall into
  the double-down zone (with how deep it went and the change three months
  later), each 20% month, and each crossing of a trim level. Tap one to bring
  its marker into view.
- **Price levels** list every entry and trim level from high to low around
  today's price, with the distance to each.
- **Data and definitions:** six years of daily bars from Yahoo Finance (closes
  are split-adjusted), so the 52-week high is known from the first day shown.
  The 52-week high is the highest *close* in the past 365 days, and a month is
  30 days. Monthly candles are rolled up from the daily bars. The engine is
  pure and tested in `src/features/dca/`; the thresholds are `RULES` in
  `rules.ts`.

## The watchlist

*Add to Watchlist* on a stock's page, or the **+** on the watchlist page, which
opens a search sheet with popular picks. The list (`/watchlist`, or the
*Watchlist* tab on phones) shows each stock's score shape, price and grade, with
a bar of how many are Strong, Mixed and Weak.

- **Grades** use the same rule as the stock page. They include Claude's six
  scores when this browser has a cached analysis for the stock; otherwise the
  row says *Market data only*, and the overview counts how many include Claude.
- **Sort** by your order, score, symbol or most recently added (the **⋯** menu).
- **Edit** to drag rows into your order (or use the arrow keys on a row's grip),
  and tap ⊖ to delete. On touch screens, swipe a row left to delete it; a long
  swipe deletes at once. Deleting shows *Undo*. *Clear Watchlist* asks first.
- **Storage:** the list stays on this device (`localStorage`), up to 100 stocks.
  Each row's market data comes from `/api/stock` and is saved with the list, so
  it opens instantly and still shows offline, with its "as of" time. It is
  fetched again when it's over 15 minutes old, when the app comes back to the
  foreground or online, or on *Refresh Data*.

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

A new deploy reaches an installed app in one of three ways:

1. **Opening the app:** pages load network-first, so it gets the latest version.
2. **Moving to another page:** the build id is also Next.js's `deploymentId`, so
   a client-side navigation across a deploy turns into a full reload.
3. **Staying on one page:** the app re-checks when it returns to the
   foreground, comes back online, or every 15 minutes, and shows *New version
   available · Reload*. Reload waits while Claude is mid-analysis, so a paid
   run isn't thrown away.

Each build bakes in an id (Vercel's deployment id, or the git commit locally)
that `/api/version` also reports; the notice shows when the two differ. The
footer shows the version a window is running (`Version <commit> · built <time>`).
Bump `VERSION` in `public/sw.js` when changing what the service worker caches.

## Running it

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:3000, live Yahoo Finance data; enter your Claude key in the page
npm run dev:demo     # offline: deterministic fake data and scores, clearly labelled
npm run check        # lint + typecheck + unit tests
npm run universe     # refresh the S&P 500 / Nasdaq-100 list (src/features/universe/data/universe.json)
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
src/app/                       routes: / · /stock/[symbol] · /stock/[symbol]/chart · /watchlist · /offline · /api/stock/[symbol] · /api/version
src/features/
  scoring/                     metric catalogue, thresholds and pure scoring rules (the spec lives here)
  market-data/                 fundamentals and daily-history types + pure derivations; yahoo.ts does the I/O;
                               report.ts caches the report and the price history (server only)
  universe/                    S&P 500 ∪ Nasdaq-100 list, search, and the StockPicker
  analysis/                    Claude scoring: prompt + tool schema (prompt.ts), API loop (claude.ts),
                               browser key + cache (browser-store.ts), hook and status/summary components
  scorecard/                   model.ts turns data + scores into rows, meters, totals and callouts (pure, tested);
                               presenters.ts says how each market metric is shown; components/ render the page
  radar/                       radar geometry (pure, tested), the animated RadarChart, and the RadarGlyph mark
  pwa/                         service-worker registration, install/offline controls, the update notice,
                               the build id (version.ts) and the footer's version label
  watchlist/                   watchlist.ts (list edits and sorting) and summary.ts (a row's grade), pure and tested;
                               store.ts keeps the list and row data in the browser; components/ for the page,
                               rows, the add sheet and the stock page's button
  dca/                         the DCA rules (rules.ts), rolling 52-week high and monthly change (series.ts),
                               today's call (advice.ts), key points, monthly candles and the wording (copy.ts),
                               all pure and tested; store.ts keeps your average price; components/ hold the
                               view and the Lightweight Charts wrapper
  navigation/                  the phone tab bar and the header's watchlist link
src/lib/                       format.ts (numbers and money); browser-storage.ts (guarded local/session storage
                               that notifies subscribers, for useSyncExternalStore)
src/ui/                        Panel, Button, Callout, ScorePill, Meter, Gauge, TierBar, CountUp, LocalTime,
                               Skeleton, Icon, the motion hooks (useTween, reduced-motion aware), and the
                               iOS-style controls: Menu, Sheet + ActionSheet, SegmentedControl, TabLinks, SwipeActions,
                               Toast, and useDragReorder
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
