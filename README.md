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

On a stock's page, Claude Opus 5.5 (`claude-opus-5-5`) gets the rubric above.
It checks recent facts with web search (the current CEO, leadership changes,
layoffs, scandals), then answers by calling a strict `submit_scores` tool. The
app validates the answer: every metric must be present, and each score must be
exactly 0, 5 or 10. Each metric gets a one- or two-sentence rationale, and the
page shows Claude's summary and the sources it relied on. Only URLs that its
searches actually returned are listed.

- **Caching:** an analysis is cached for a week per stock in Next's data cache,
  and the cache survives deploys. A first view takes about a minute while
  Claude researches; the market-data scores show right away. To force fresh
  analyses after changing the prompt, bump `ANALYSIS_VERSION` in
  `src/lib/analysis/prompt.ts`.
- **Refusals:** if a safety classifier declines, the request falls back
  server-side to Anthropic's recommended model (`fallbacks: "default"`). The
  page names the model that answered.
- **Cost:** each analysis is one Opus 5.5 conversation at `high` effort with up
  to 6 web searches. It's billed to your Anthropic account, roughly tens of
  cents per stock per week. Anyone who can open the site can trigger it.
- **No key:** without `ANTHROPIC_API_KEY`, metrics 8–13 show "Not scored" and the
  rest of the app works.

## Running it

Requires Node 22+.

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # for Claude's scores (metrics 8–13)
npm run dev          # http://localhost:3000, live Yahoo Finance data + Claude
npm run dev:demo     # offline: deterministic fake data and scores, clearly labelled
npm run check        # lint + typecheck + unit tests
npm run universe     # refresh the S&P 500 / Nasdaq-100 list (src/data/universe.json)
```

On Vercel, set `ANTHROPIC_API_KEY` under Project → Settings → Environment
Variables (Production and Preview). Web search must be enabled for your
organization in the Claude Console.

Market data comes from Yahoo Finance via [`yahoo-finance2`](https://github.com/gadicc/yahoo-finance2).
No API key is needed. The data is unofficial and delayed, so treat it as a
screening aid and not as investment advice. Responses are cached for about an
hour per stock.

`GET /api/stock/:symbol` returns the same report as JSON, including Claude's
`analysis`.

## Layout

```
scripts/build-universe.mjs   regenerates the ticker list from public sources
src/data/universe.json       S&P 500 ∪ Nasdaq-100, one stock per line
src/lib/scoring/             metric catalogue + pure scoring rules (the spec lives here)
src/lib/data/                fundamentals type + pure derivations; yahoo.ts does the I/O
src/lib/report.ts            cached fetch → score pipeline (server only)
src/lib/analysis/            Claude scoring: prompt + tool schema + validation (prompt.ts),
                             the API loop (claude.ts), caching and fallbacks (index.ts)
src/components/              StockPicker, RadarChart, Scorecard
src/app/                     / (intro), /stock/[symbol] (report), /api/stock/[symbol]
```

To change a threshold, edit `src/lib/scoring/score.ts`. Its tests in
`score.test.ts` pin every boundary.
