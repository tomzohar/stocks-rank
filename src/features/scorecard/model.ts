// The scorecard as data: one row per metric with its score, figure, meter and
// takeaway, group subtotals, a grade and the callouts. Pure, so the whole
// page's content can be tested without rendering.
import type { AnalysisState } from "@/features/analysis/types";
import type { StockFundamentals } from "@/features/market-data/fundamentals";
import {
  MAX_METRIC_SCORE,
  METRICS,
  type MetricDefinition,
  type QualitativeMetricId,
  type QuantitativeMetricId,
  type Score,
} from "@/features/scoring/metrics";
import { totalScore, type Scores, type Total } from "@/features/scoring/score";
import type { MeterSpec } from "@/ui/Meter";
import type { Tone } from "@/ui/tone";
import { PRESENTERS, type Figure } from "./presenters";

export const scoreTone = (s: Score | null): Tone =>
  s === null ? "neutral" : s === 10 ? "good" : s === 5 ? "warning" : "critical";

/**
 * - scored: has a 0/5/10
 * - no-data: market data was missing (n/a, not 0)
 * - pending: Claude is still working on it
 * - unscored: Claude can't score it yet (no key, or the run failed)
 */
export type RowState = "scored" | "no-data" | "pending" | "unscored";

export interface MetricRow {
  metric: MetricDefinition;
  /** 1-based position, as in the spec. */
  number: number;
  score: Score | null;
  state: RowState;
  tone: Tone;
  /** The rubric line the score earned, e.g. "Cash ≥ 2× debt". */
  verdict: string | null;
  figure: Figure | null;
  meter: MeterSpec | null;
  /** Claude's evidence (judgement metrics only). */
  rationale: string | null;
  takeaway: string | null;
}

export interface GroupSummary {
  kind: MetricDefinition["kind"];
  rows: MetricRow[];
  points: number;
  /** Most points the group can earn (every metric at 10). */
  max: number;
  scoredCount: number;
}

export interface Grade {
  label: "Strong" | "Mixed" | "Weak";
  tone: Tone;
}

export interface Callout {
  metric: MetricDefinition;
  text: string;
}

export interface ScorecardModel {
  rows: MetricRow[];
  quantitative: GroupSummary;
  qualitative: GroupSummary;
  total: Total;
  grade: Grade | null;
  /** How many metrics landed on 10, 5, 0, or have no score yet. */
  tiers: { ten: number; five: number; zero: number; none: number };
  strengths: Callout[];
  watchOuts: Callout[];
}

/** Grades the share of available points earned on the metrics that have a score. */
export function gradeFor(ratio: number | null): Grade | null {
  if (ratio === null) return null;
  if (ratio >= 0.7) return { label: "Strong", tone: "good" };
  if (ratio >= 0.4) return { label: "Mixed", tone: "warning" };
  return { label: "Weak", tone: "critical" };
}

function qualitativeState(analysis: AnalysisState): RowState {
  switch (analysis.status) {
    case "ready":
      return "scored";
    case "checking":
    case "pending":
      return "pending";
    case "needs-key":
    case "error":
      return "unscored";
  }
}

function summarize(kind: MetricDefinition["kind"], rows: MetricRow[]): GroupSummary {
  const own = rows.filter((r) => r.metric.kind === kind);
  const scored = own.filter((r) => r.score !== null);
  return {
    kind,
    rows: own,
    points: scored.reduce((n, r) => n + (r.score ?? 0), 0),
    max: own.length * MAX_METRIC_SCORE,
    scoredCount: scored.length,
  };
}

export function buildScorecard({
  fundamentals,
  quantitative,
  analysis,
}: {
  fundamentals: StockFundamentals;
  quantitative: Record<QuantitativeMetricId, Score | null>;
  analysis: AnalysisState;
}): ScorecardModel {
  const assessed = analysis.status === "ready" ? analysis.analysis.metrics : null;
  const claudeState = qualitativeState(analysis);

  const rows: MetricRow[] = METRICS.map((metric, i) => {
    if (metric.kind === "quantitative") {
      const id = metric.id as QuantitativeMetricId;
      const score = quantitative[id] ?? null;
      const p = PRESENTERS[id];
      return {
        metric,
        number: i + 1,
        score,
        state: score === null ? "no-data" : "scored",
        tone: scoreTone(score),
        verdict: score === null ? null : metric.criteria[score],
        figure: p.figure(fundamentals),
        meter: p.meter(fundamentals, score),
        rationale: null,
        takeaway: p.takeaway(fundamentals),
      };
    }
    const a = assessed?.[metric.id as QualitativeMetricId] ?? null;
    const score = a?.score ?? null;
    return {
      metric,
      number: i + 1,
      score,
      state: claudeState,
      tone: scoreTone(score),
      verdict: score === null ? null : metric.criteria[score],
      figure: null,
      meter: null,
      rationale: a?.rationale ?? null,
      takeaway: score === null ? null : `${metric.label}: ${metric.criteria[score].toLowerCase()}`,
    };
  });

  const scores: Scores = Object.fromEntries(rows.map((r) => [r.metric.id, r.score]));
  const total = totalScore(scores);
  const callout = (r: MetricRow): Callout => ({ metric: r.metric, text: r.takeaway ?? `${r.metric.label}: ${r.verdict}` });

  return {
    rows,
    quantitative: summarize("quantitative", rows),
    qualitative: summarize("qualitative", rows),
    total,
    grade: gradeFor(total.ratio),
    tiers: {
      ten: rows.filter((r) => r.score === 10).length,
      five: rows.filter((r) => r.score === 5).length,
      zero: rows.filter((r) => r.score === 0).length,
      none: rows.filter((r) => r.score === null).length,
    },
    strengths: rows.filter((r) => r.score === 10).map(callout),
    watchOuts: rows.filter((r) => r.score === 0).map(callout),
  };
}
