"use client";

import { useMemo, useState } from "react";
import { forgetApiKey, keyHint } from "@/lib/analysis/browser-store";
import { analysisSubject } from "@/lib/analysis/subject";
import type { AnalysisState } from "@/lib/analysis/types";
import type { StockFundamentals } from "@/lib/data/fundamentals";
import { formatMoney, formatPercent, formatPoints, formatPrice } from "@/lib/format";
import {
  MAX_TOTAL_SCORE,
  METRICS,
  QUALITATIVE_METRIC_IDS,
  SCORE_VALUES,
  type MetricDefinition,
  type MetricId,
  type QualitativeMetricId,
  type QuantitativeMetricId,
  type Score,
} from "@/lib/scoring/metrics";
import { totalScore, type Scores } from "@/lib/scoring/score";
import { INDEX_LABELS, type Stock } from "@/lib/universe";
import { ApiKeyForm } from "./ApiKeyForm";
import { RadarChart, scoreTone } from "./RadarChart";
import { useClaudeAnalysis } from "./useClaudeAnalysis";

export function Scorecard({
  stock,
  fundamentals: f,
  scores: quantitative,
}: {
  stock: Stock;
  fundamentals: StockFundamentals;
  scores: Record<QuantitativeMetricId, Score | null>;
}) {
  const [highlighted, setHighlighted] = useState<MetricId | null>(null);
  const subject = useMemo(() => analysisSubject(stock), [stock]);
  const claude = useClaudeAnalysis(subject, f.source === "demo" ? f.asOf : null);
  const analysis = claude.state;

  const assessed = analysis.status === "ready" ? analysis.analysis.metrics : null;
  const qualitative = Object.fromEntries(
    QUALITATIVE_METRIC_IDS.map((id) => [id, assessed?.[id].score ?? null]),
  ) as Record<QualitativeMetricId, Score | null>;
  const pending = analysis.status === "pending" || analysis.status === "checking";

  const scores: Scores = { ...quantitative, ...qualitative };
  const total = totalScore(scores);
  const axes = METRICS.map((m) => ({
    id: m.id,
    label: m.label,
    kind: m.kind,
    score: scores[m.id] ?? null,
    pending: pending && m.kind === "qualitative",
  }));
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

      <AnalysisBanner analysis={analysis} onRetry={claude.retry} />

      <div className="scorecard-grid">
        <section className="panel">
          <div className="total">
            <span className="total-points">{total.points}</span>
            <span className="total-max">/ {MAX_TOTAL_SCORE}</span>
            <span className="muted total-note">
              {total.scoredCount} of {METRICS.length} metrics scored
              {total.ratio !== null && ` · ${Math.round(total.ratio * 100)}% of the points available on those`}
              {analysis.status === "pending" && " · Claude is scoring the rest"}
            </span>
          </div>
          <RadarChart axes={radarAxes} highlighted={highlighted} onHighlight={setHighlighted} />
          <AnalysisPanel analysis={analysis} apiKey={claude.apiKey} onReanalyze={claude.reanalyze} />
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
                      <Rationale analysis={analysis} id={m.id as QualitativeMetricId} />
                    )}
                  </td>
                  <td className="num">
                    {pending && m.kind === "qualitative" ? (
                      <span className="badge tone-none is-pending">…</span>
                    ) : (
                      <ScoreBadge score={scores[m.id] ?? null} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted footnote">
            Metrics 8–13 are judgement calls scored by Claude after researching the company on the web; treat them as an
            informed opinion. Growth and scalability compare the last two fiscal years; the 5-year comparison uses
            dividend-adjusted prices against SPY.
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

function Rationale({ analysis, id }: { analysis: AnalysisState; id: QualitativeMetricId }) {
  switch (analysis.status) {
    case "checking":
    case "pending":
      return <span className="skeleton-text" aria-label="Claude is analyzing" />;
    case "ready":
      return <span className="rationale">{analysis.analysis.metrics[id].rationale}</span>;
    case "needs-key":
    case "error":
      return <span className="stat-sub">Not scored</span>;
  }
}

/** Who scored metrics 8–13, Claude's summary, and its sources. */
/** Says loudly what's happening with metrics 8–13 until Claude's scores are in. */
function AnalysisBanner({ analysis, onRetry }: { analysis: AnalysisState; onRetry: () => void }) {
  switch (analysis.status) {
    case "ready":
    case "checking":
      return null;
    case "needs-key":
      return (
        <div className="banner banner-key" role="region" aria-label="Set up Claude scoring">
          <div>
            <strong>Let Claude score metrics 8–13.</strong> Enter your Claude API key. Claude researches the company on
            the web and scores moat, CEO, recession resilience, secular trend, culture and talent.
          </div>
          <ApiKeyForm />
        </div>
      );
    case "pending":
      return (
        <div className="banner banner-pending" role="status">
          <span className="spinner" aria-hidden="true" />
          <span>
            <strong>Claude is scoring metrics 8–13.</strong> It&apos;s researching the company on the web, which takes
            about a minute. Scores fill in here when it&apos;s done.
          </span>
        </div>
      );
    case "error":
      return (
        <div className="banner banner-error" role="alert">
          <div className="banner-row">
            <span className="banner-icon" aria-hidden="true">×</span>
            <span>
              <strong>Claude couldn&apos;t score metrics 8–13.</strong> {analysis.message}
            </span>
            {!analysis.keyRejected && (
              <button type="button" className="button" onClick={onRetry}>
                Try again
              </button>
            )}
          </div>
          {analysis.keyRejected && <ApiKeyForm submitLabel="Use this key instead" />}
        </div>
      );
  }
}

/** Claude's summary, who scored it, its sources, and the key controls. */
function AnalysisPanel({
  analysis,
  apiKey,
  onReanalyze,
}: {
  analysis: AnalysisState;
  apiKey: string | null;
  onReanalyze: () => void;
}) {
  const keyControls = apiKey && (
    <p className="muted key-status">
      Using your key {keyHint(apiKey)} ·{" "}
      <button type="button" className="link-button" onClick={forgetApiKey}>
        Forget key
      </button>
    </p>
  );
  if (analysis.status !== "ready") return keyControls ? <div className="analysis">{keyControls}</div> : null;
  const a = analysis.analysis;
  // Only plain web links: never render a javascript: or data: URL as a link.
  const sources = a.sources.filter((src) => isWebUrl(src.url));
  const when = new Date(a.analyzedAt).toLocaleDateString("en-US", { dateStyle: "medium" });
  return (
    <div className="analysis">
      <h2>{a.source === "demo" ? "Demo analysis" : "Claude's take"}</h2>
      <p>{a.summary}</p>
      <p className="muted analysis-meta">
        {a.source === "demo" ? "Generated offline, not real" : `Scored by ${modelLabel(a.model)} on ${when}`}
        {a.source === "claude" && apiKey && (
          <>
            {" · "}
            <button type="button" className="link-button" onClick={onReanalyze}>
              Re-analyze
            </button>
          </>
        )}
      </p>
      {sources.length > 0 && (
        <details className="sources">
          <summary>Sources ({sources.length})</summary>
          <ul>
            {sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noopener noreferrer">
                  {src.title}
                </a>{" "}
                <span className="muted">{hostname(src.url)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {keyControls}
    </div>
  );
}

function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

const MODEL_NAMES: Record<string, string> = {
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-opus-5": "Claude Opus 5",
  "claude-opus-4-8": "Claude Opus 4.8",
};
const modelLabel = (id: string) => MODEL_NAMES[id] ?? id;

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
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
