// The 13 metrics a stock is ranked on. Every metric scores 0, 5 or 10, so a
// stock's maximum is 130. Metrics 1-7 are computed from market data; 8-13 are
// judgement calls the user enters themselves.

export type Score = 0 | 5 | 10;
export const SCORE_VALUES: readonly Score[] = [0, 5, 10];
export const MAX_METRIC_SCORE = 10;

export const QUANTITATIVE_METRIC_IDS = [
  "cashVsDebt",
  "revenueGrowth",
  "operatingMargin",
  "shortInterest",
  "institutionalOwnership",
  "scalability",
  "fiveYearVsSp500",
] as const;

export const QUALITATIVE_METRIC_IDS = [
  "moat",
  "ceo",
  "recessionProof",
  "secularTrend",
  "culture",
  "talent",
] as const;

export type QuantitativeMetricId = (typeof QUANTITATIVE_METRIC_IDS)[number];
export type QualitativeMetricId = (typeof QUALITATIVE_METRIC_IDS)[number];
export type MetricId = QuantitativeMetricId | QualitativeMetricId;

export interface MetricDefinition {
  id: MetricId;
  /** Full name, used in the statistics table. */
  label: string;
  /** Short name that fits on a radar-chart axis. */
  axisLabel: string;
  kind: "quantitative" | "qualitative";
  /** How each score is earned, shown to the user as-is. */
  criteria: Record<Score, string>;
}

export const METRICS: readonly MetricDefinition[] = [
  {
    id: "cashVsDebt",
    label: "Cash > Debt",
    axisLabel: "Cash/Debt",
    kind: "quantitative",
    criteria: { 0: "Debt ≥ cash", 5: "Cash > debt", 10: "Cash ≥ 2× debt" },
  },
  {
    id: "revenueGrowth",
    label: "Revenue growth",
    axisLabel: "Rev growth",
    kind: "quantitative",
    criteria: { 0: "Below 10%", 5: "10% – 20%", 10: "20% or more" },
  },
  {
    id: "operatingMargin",
    label: "Operating margin",
    axisLabel: "Op margin",
    kind: "quantitative",
    criteria: { 0: "Below 10%", 5: "10% – 25%", 10: "25% or more" },
  },
  {
    id: "shortInterest",
    label: "Short interest",
    axisLabel: "Short int.",
    kind: "quantitative",
    criteria: { 0: "10% of float or more", 5: "5% – 10%", 10: "Below 5%" },
  },
  {
    id: "institutionalOwnership",
    label: "Institutional ownership",
    axisLabel: "Institutions",
    kind: "quantitative",
    criteria: { 0: "Below 30%", 5: "30% – 60%", 10: "Above 60%" },
  },
  {
    id: "scalability",
    label: "Scalability",
    axisLabel: "Scalability",
    kind: "quantitative",
    criteria: {
      0: "Expenses growing as fast as revenue or faster",
      5: "—",
      10: "Revenue growing faster than expenses",
    },
  },
  {
    id: "fiveYearVsSp500",
    label: "Share price, 5 years vs S&P 500",
    axisLabel: "5Y vs S&P",
    kind: "quantitative",
    criteria: {
      0: "Less than 10 pts above the S&P 500",
      5: "10 – 20 pts above",
      10: "20 pts or more above",
    },
  },
  qualitative("moat", "Moat", "Moat"),
  qualitative("ceo", "CEO", "CEO"),
  qualitative("recessionProof", "Recession proof", "Recession"),
  qualitative("secularTrend", "Secular trend", "Trend"),
  qualitative("culture", "Culture / mission", "Culture"),
  qualitative("talent", "Talent", "Talent"),
];

function qualitative(id: QualitativeMetricId, label: string, axisLabel: string): MetricDefinition {
  return {
    id,
    label,
    axisLabel,
    kind: "qualitative",
    criteria: { 0: "Weak", 5: "Average", 10: "Strong" },
  };
}

export const MAX_TOTAL_SCORE = METRICS.length * MAX_METRIC_SCORE;
