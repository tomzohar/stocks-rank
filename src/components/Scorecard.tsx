"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { StockFundamentals } from "@/lib/data/fundamentals";
import { formatMoney, formatPercent, formatPoints, formatPrice } from "@/lib/format";
import { getRaw, parseQualitative, setScore, subscribe } from "@/lib/qualitative-store";
import {
  MAX_TOTAL_SCORE,
  METRICS,
  SCORE_VALUES,
  type MetricDefinition,
  type MetricId,
  type QualitativeMetricId,
  type QuantitativeMetricId,
  type Score,
} from "@/lib/scoring/metrics";
import { totalScore, type Scores } from "@/lib/scoring/score";
import { INDEX_LABELS, type Stock } from "@/lib/universe";
import { RadarChart, scoreTone } from "./RadarChart";

export function Scorecard({
  stock,
  fundamentals: f,
  scores: quantitative,
}: {
  stock: Stock;
  fundamentals: StockFundamentals;
  scores: Record<QuantitativeMetricId, Score | null>;
}) {
  const raw = useSyncExternalStore(
    subscribe,
    () => getRaw(stock.symbol),
    () => null,
  );
  const qualitative = useMemo(() => parseQualitative(raw), [raw]);
  const [highlighted, setHighlighted] = useState<MetricId | null>(null);

  const scores: Scores = { ...quantitative, ...qualitative };
  const total = totalScore(scores);
  const axes = METRICS.map((m) => ({ id: m.id, label: m.label, kind: m.kind, score: scores[m.id] ?? null }));
  // The radar has room for short labels only.
  const radarAxes = axes.map((a, i) => ({ ...a, label: METRICS[i].axisLabel }));

  return (
    <article className="scorecard">
      <header className="panel stock-head">
        <div>
          <h1>
            {stock.symbol} <span className="stock-name">{f.name || stock.name}</span>
          </h1>
          {f.source === "demo" && (
            <p className="demo-flag" role="note">
              Demo data — generated offline, not real figures
            </p>
          )}
          <p className="muted">
            {[stock.sector, stock.indexes.map((i) => INDEX_LABELS[i]).join(" · ")].filter(Boolean).join(" — ")}
          </p>
        </div>
        <div className="stock-price">
          <span className="price">{formatPrice(f.price, f.currency)}</span>
          <span className="muted">as of {new Date(f.asOf).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
      </header>

      <div className="scorecard-grid">
        <section className="panel">
          <div className="total">
            <span className="total-points">{total.points}</span>
            <span className="total-max">/ {MAX_TOTAL_SCORE}</span>
            <span className="muted total-note">
              {total.scoredCount} of {METRICS.length} metrics scored
              {total.ratio !== null && ` · ${Math.round(total.ratio * 100)}% of the points available on those`}
            </span>
          </div>
          <RadarChart axes={radarAxes} highlighted={highlighted} onHighlight={setHighlighted} />
        </section>

        <section className="panel">
          <h2>Statistics</h2>
          <table className="metrics">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Value</th>
                <th scope="col" className="num">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m, i) => (
                <tr
                  key={m.id}
                  className={highlighted === m.id ? "is-hi" : undefined}
                  onMouseEnter={() => setHighlighted(m.id)}
                  onMouseLeave={() => setHighlighted(null)}
                >
                  <th scope="row">
                    <span className="metric-num">{i + 1}.</span> {m.label}
                    <Criteria metric={m} />
                  </th>
                  <td>
                    {m.kind === "quantitative" ? (
                      <Statistic id={m.id as QuantitativeMetricId} f={f} />
                    ) : (
                      <ScoreInput
                        label={m.label}
                        value={qualitative[m.id as QualitativeMetricId] ?? null}
                        onChange={(s) => setScore(stock.symbol, m.id as QualitativeMetricId, s)}
                      />
                    )}
                  </td>
                  <td className="num">
                    <ScoreBadge score={scores[m.id] ?? null} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted footnote">
            Scores for metrics 8–13 are saved in this browser only. Growth and scalability compare the last two fiscal
            years; the 5-year comparison uses dividend-adjusted prices against SPY.
          </p>
        </section>
      </div>
    </article>
  );
}

function Criteria({ metric }: { metric: MetricDefinition }) {
  return (
    <span className="criteria">
      {SCORE_VALUES.filter((s) => metric.criteria[s] !== "—")
        .map((s) => `${s}: ${metric.criteria[s]}`)
        .join(" · ")}
    </span>
  );
}

function ScoreBadge({ score }: { score: Score | null }) {
  return (
    <span className={`badge tone-${scoreTone(score)}`} title={score === null ? "No data" : undefined}>
      {score ?? "n/a"}
    </span>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Score | null;
  onChange: (s: Score | null) => void;
}) {
  return (
    <div className="score-input" role="group" aria-label={`${label} score`}>
      {SCORE_VALUES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          onClick={() => onChange(value === s ? null : s)}
          title={value === s ? "Click again to clear" : undefined}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function Statistic({ id, f }: { id: QuantitativeMetricId; f: StockFundamentals }) {
  const fc = f.financialCurrency ?? f.currency;
  switch (id) {
    case "cashVsDebt": {
      const ratio = f.totalCash != null && f.totalDebt ? f.totalCash / f.totalDebt : null;
      return (
        <Stat
          main={`${formatMoney(f.totalCash, fc)} cash`}
          sub={`${formatMoney(f.totalDebt, fc)} debt${ratio !== null ? ` · ${ratio.toFixed(2)}×` : ""}`}
        />
      );
    }
    case "revenueGrowth":
      return <Stat main={formatPercent(f.revenueGrowth, { signed: true })} sub={f.growthPeriod} />;
    case "operatingMargin":
      return <Stat main={formatPercent(f.operatingMargin)} sub="Trailing 12 months" />;
    case "shortInterest":
      return <Stat main={formatPercent(f.shortPercentOfFloat)} sub="of float" />;
    case "institutionalOwnership":
      return <Stat main={formatPercent(f.institutionalOwnership)} sub="of shares" />;
    case "scalability":
      return (
        <Stat
          main={`Revenue ${formatPercent(f.revenueGrowth, { signed: true })}`}
          sub={`Expenses ${formatPercent(f.expenseGrowth, { signed: true })}`}
        />
      );
    case "fiveYearVsSp500": {
      const lead =
        f.fiveYearReturn != null && f.sp500FiveYearReturn != null ? f.fiveYearReturn - f.sp500FiveYearReturn : null;
      return (
        <Stat
          main={f.fiveYearReturn == null ? "Under 5 years of history" : formatPoints(lead)}
          sub={`Stock ${formatPercent(f.fiveYearReturn, { signed: true })} · S&P 500 ${formatPercent(f.sp500FiveYearReturn, { signed: true })}`}
        />
      );
    }
  }
}

function Stat({ main, sub }: { main: string; sub?: string | null }) {
  return (
    <>
      <span className="stat-main">{main}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </>
  );
}
