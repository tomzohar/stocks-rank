// How each market-data metric is shown: its figure, a meter against the
// scoring cut-offs, and a one-line takeaway. Adding a metric means adding its
// rule in scoring/ and an entry here; the scorecard picks it up from METRICS.
import type { StockFundamentals } from "@/features/market-data/fundamentals";
import type { QuantitativeMetricId, Score } from "@/features/scoring/metrics";
import { THRESHOLDS } from "@/features/scoring/score";
import { formatMoney, formatPercent, formatPoints } from "@/lib/format";
import type { MeterBand, MeterSpec } from "@/ui/Meter";

export interface Figure {
  main: string;
  sub?: string | null;
}

export interface MetricPresenter {
  figure(f: StockFundamentals): Figure;
  /** Where the figure sits against the cut-offs; null when there's nothing to plot. */
  meter(f: StockFundamentals, score: Score | null): MeterSpec | null;
  /** A plain-language takeaway for the callouts, or null without data. */
  takeaway(f: StockFundamentals): string | null;
}

const isNum = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

interface Tiered {
  bands: MeterBand[];
  /** Score earned in each band, in band order. */
  scores: Score[];
}

/** Bands for "more is better": below mid scores 0, mid to high 5, from high 10. */
function higherIsBetter(mid: number, high: number, max: number): Tiered {
  return {
    bands: [
      { to: mid, tone: "critical" },
      { to: high, tone: "warning" },
      { to: max, tone: "good" },
    ],
    scores: [0, 5, 10],
  };
}

/** Bands for "less is better": below high scores 10, up to mid 5, beyond 0. */
function lowerIsBetter(high: number, mid: number, max: number): Tiered {
  return {
    bands: [
      { to: high, tone: "good" },
      { to: mid, tone: "warning" },
      { to: max, tone: "critical" },
    ],
    scores: [10, 5, 0],
  };
}

function meter(
  value: number | null | undefined,
  min: number,
  max: number,
  tiers: Tiered,
  ticks: MeterSpec["ticks"],
  score: Score | null,
): MeterSpec | null {
  if (!isNum(value)) return null;
  // The score decides which band lights up: a value exactly on a cut-off
  // can belong to either side depending on the rule ("above 60%" vs "60%+").
  const active = score === null ? undefined : tiers.scores.indexOf(score);
  return { min, max, value, bands: tiers.bands, ticks, active: active === -1 ? undefined : active };
}

const cashRatio = (f: StockFundamentals): number | null => {
  if (!isNum(f.totalCash) || !isNum(f.totalDebt)) return null;
  if (f.totalDebt === 0) return f.totalCash > 0 ? Number.POSITIVE_INFINITY : null;
  return f.totalCash / f.totalDebt;
};

const fiveYearLead = (f: StockFundamentals): number | null =>
  isNum(f.fiveYearReturn) && isNum(f.sp500FiveYearReturn) ? f.fiveYearReturn - f.sp500FiveYearReturn : null;

const scalabilityGap = (f: StockFundamentals): number | null =>
  isNum(f.revenueGrowth) && isNum(f.expenseGrowth) ? f.revenueGrowth - f.expenseGrowth : null;

export const PRESENTERS: Record<QuantitativeMetricId, MetricPresenter> = {
  cashVsDebt: {
    figure(f) {
      const fc = f.financialCurrency ?? f.currency;
      const r = cashRatio(f);
      return {
        main: r === Number.POSITIVE_INFINITY ? "No debt" : r === null ? "—" : `${r.toFixed(2)}× debt`,
        sub: `${formatMoney(f.totalCash, fc)} cash · ${formatMoney(f.totalDebt, fc)} debt`,
      };
    },
    meter(f, score) {
      const { mid, high } = THRESHOLDS.cashToDebt;
      const r = cashRatio(f);
      // No debt: plot it off the top of the scale.
      return meter(r === Number.POSITIVE_INFINITY ? Number.MAX_VALUE : r, 0, 4, higherIsBetter(mid, high, 4), [
        { at: mid, label: `${mid}×` },
        { at: high, label: `${high}×` },
      ], score);
    },
    takeaway(f) {
      const r = cashRatio(f);
      if (r === null) return null;
      if (r === Number.POSITIVE_INFINITY) return "No debt on the balance sheet";
      if (r >= 1) return `Cash covers debt ${r.toFixed(1)}× over`;
      return `Debt outweighs cash: cash covers ${Math.round(r * 100)}% of it`;
    },
  },
  revenueGrowth: {
    figure: (f) => ({ main: formatPercent(f.revenueGrowth, { signed: true }), sub: f.growthPeriod ?? "Latest quarter, year over year" }),
    meter(f, score) {
      const { mid, high } = THRESHOLDS.revenueGrowth;
      return meter(f.revenueGrowth, -0.1, 0.4, higherIsBetter(mid, high, 0.4), [
        { at: mid, label: pct(mid) },
        { at: high, label: pct(high) },
      ], score);
    },
    takeaway: (f) =>
      isNum(f.revenueGrowth)
        ? `Revenue ${f.revenueGrowth >= 0 ? "grew" : "shrank"} ${pct(Math.abs(f.revenueGrowth))}${f.growthPeriod ? ` (${f.growthPeriod})` : ""}`
        : null,
  },
  operatingMargin: {
    figure: (f) => ({ main: formatPercent(f.operatingMargin), sub: "Trailing 12 months" }),
    meter(f, score) {
      const { mid, high } = THRESHOLDS.operatingMargin;
      return meter(f.operatingMargin, -0.1, 0.5, higherIsBetter(mid, high, 0.5), [
        { at: mid, label: pct(mid) },
        { at: high, label: pct(high) },
      ], score);
    },
    takeaway: (f) =>
      isNum(f.operatingMargin)
        ? f.operatingMargin >= 0
          ? `Keeps ${pct(f.operatingMargin)} of revenue as operating profit`
          : `Operating at a loss (${pct(f.operatingMargin)} margin)`
        : null,
  },
  shortInterest: {
    figure: (f) => ({ main: formatPercent(f.shortPercentOfFloat), sub: "of float sold short" }),
    meter(f, score) {
      const { mid, high } = THRESHOLDS.shortInterest;
      return meter(f.shortPercentOfFloat, 0, 0.2, lowerIsBetter(high, mid, 0.2), [
        { at: high, label: pct(high) },
        { at: mid, label: pct(mid) },
      ], score);
    },
    takeaway: (f) => (isNum(f.shortPercentOfFloat) ? `${pct(f.shortPercentOfFloat)} of the float is sold short` : null),
  },
  institutionalOwnership: {
    figure: (f) => ({ main: formatPercent(f.institutionalOwnership), sub: "of shares held by institutions" }),
    meter(f, score) {
      const { mid, high } = THRESHOLDS.institutionalOwnership;
      return meter(f.institutionalOwnership, 0, 1, higherIsBetter(mid, high, 1), [
        { at: mid, label: pct(mid) },
        { at: high, label: pct(high) },
      ], score);
    },
    takeaway: (f) =>
      isNum(f.institutionalOwnership) ? `Institutions hold ${pct(f.institutionalOwnership)} of the shares` : null,
  },
  scalability: {
    figure: (f) => {
      const gap = scalabilityGap(f);
      return {
        main: gap === null ? "—" : `${formatPoints(gap)} gap`,
        sub: `Revenue ${formatPercent(f.revenueGrowth, { signed: true })} · expenses ${formatPercent(f.expenseGrowth, { signed: true })}`,
      };
    },
    meter(f, score) {
      // Revenue growth minus expense growth: any positive gap scores 10.
      return meter(
        scalabilityGap(f),
        -0.2,
        0.2,
        { bands: [{ to: 0, tone: "critical" }, { to: 0.2, tone: "good" }], scores: [0, 10] },
        [{ at: 0, label: "even" }],
        score,
      );
    },
    takeaway(f) {
      if (!isNum(f.revenueGrowth) || !isNum(f.expenseGrowth)) return null;
      const rev = formatPercent(f.revenueGrowth, { signed: true });
      const exp = formatPercent(f.expenseGrowth, { signed: true });
      return f.revenueGrowth > f.expenseGrowth
        ? `Revenue (${rev}) outgrew expenses (${exp})`
        : `Expenses (${exp}) kept pace with or beat revenue (${rev})`;
    },
  },
  fiveYearVsSp500: {
    figure: (f) => ({
      main: f.fiveYearReturn == null ? "Under 5 years" : formatPoints(fiveYearLead(f)),
      sub: `Stock ${formatPercent(f.fiveYearReturn, { signed: true })} · S&P 500 ${formatPercent(f.sp500FiveYearReturn, { signed: true })}`,
    }),
    meter(f, score) {
      const lead = fiveYearLead(f);
      const { mid, high } = THRESHOLDS.fiveYearLeadPts;
      return meter(lead === null ? null : lead * 100, -40, 80, higherIsBetter(mid, high, 80), [
        { at: 0, label: "S&P" },
        { at: high, label: `+${high}` },
      ], score);
    },
    takeaway(f) {
      const lead = fiveYearLead(f);
      if (lead === null) return null;
      const pts = `${Math.abs(Math.round(lead * 100))} pts`;
      return lead >= 0 ? `Beat the S&P 500 by ${pts} over 5 years` : `Trailed the S&P 500 by ${pts} over 5 years`;
    },
  },
};
