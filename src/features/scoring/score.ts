// Pure scoring rules. Ratios are fractions (0.15 means 15%). A metric whose
// input is missing scores `null` — "no data", which is not the same as 0.

import {
  METRICS,
  MAX_METRIC_SCORE,
  type MetricId,
  type QuantitativeMetricId,
  type Score,
} from "./metrics";

type Num = number | null | undefined;

const isNum = (n: Num): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * The tier boundaries: `mid` earns 5, `high` earns 10. Shared with the UI's
 * meters, so the bars always show the same cut-offs the scores use.
 * Short interest is "lower is better", so its `high` is the smaller number.
 */
export const THRESHOLDS = {
  /** Cash as a multiple of debt. */
  cashToDebt: { mid: 1, high: 2 },
  revenueGrowth: { mid: 0.1, high: 0.2 },
  operatingMargin: { mid: 0.1, high: 0.25 },
  shortInterest: { mid: 0.1, high: 0.05 },
  institutionalOwnership: { mid: 0.3, high: 0.6 },
  /** Lead over the S&P 500, in percentage points. */
  fiveYearLeadPts: { mid: 10, high: 20 },
} as const;

/** 10 if cash covers debt twice over, 5 if cash exceeds debt, otherwise 0. */
export function scoreCashVsDebt(cash: Num, debt: Num): Score | null {
  if (!isNum(cash) || !isNum(debt)) return null;
  if (cash >= THRESHOLDS.cashToDebt.high * debt) return 10;
  if (cash > THRESHOLDS.cashToDebt.mid * debt) return 5;
  return 0;
}

export function scoreRevenueGrowth(growth: Num): Score | null {
  if (!isNum(growth)) return null;
  if (growth >= THRESHOLDS.revenueGrowth.high) return 10;
  if (growth >= THRESHOLDS.revenueGrowth.mid) return 5;
  return 0;
}

export function scoreOperatingMargin(margin: Num): Score | null {
  if (!isNum(margin)) return null;
  if (margin >= THRESHOLDS.operatingMargin.high) return 10;
  if (margin >= THRESHOLDS.operatingMargin.mid) return 5;
  return 0;
}

/** Short interest as a fraction of float — lower is better. */
export function scoreShortInterest(shortOfFloat: Num): Score | null {
  if (!isNum(shortOfFloat)) return null;
  if (shortOfFloat < THRESHOLDS.shortInterest.high) return 10;
  if (shortOfFloat < THRESHOLDS.shortInterest.mid) return 5;
  return 0;
}

export function scoreInstitutionalOwnership(held: Num): Score | null {
  if (!isNum(held)) return null;
  if (held > THRESHOLDS.institutionalOwnership.high) return 10;
  if (held >= THRESHOLDS.institutionalOwnership.mid) return 5;
  return 0;
}

/** 10 when revenue grew faster than expenses over the same period, else 0. */
export function scoreScalability(revenueGrowth: Num, expenseGrowth: Num): Score | null {
  if (!isNum(revenueGrowth) || !isNum(expenseGrowth)) return null;
  return revenueGrowth > expenseGrowth ? 10 : 0;
}

/**
 * Compares 5-year total returns in percentage points: a stock up 80% against
 * an S&P 500 up 65% is 15 points ahead and scores 5.
 */
export function scoreFiveYearVsSp500(stockReturn: Num, sp500Return: Num): Score | null {
  if (!isNum(stockReturn) || !isNum(sp500Return)) return null;
  const lead = stockReturn - sp500Return;
  // Rounded so float noise (0.3 - 0.1 = 0.19999…) can't drop a score a tier.
  const leadPts = Math.round(lead * 1e6) / 1e4;
  if (leadPts >= THRESHOLDS.fiveYearLeadPts.high) return 10;
  if (leadPts >= THRESHOLDS.fiveYearLeadPts.mid) return 5;
  return 0;
}

/** The market-data inputs metrics 1–7 are scored from. */
export interface QuantitativeInputs {
  totalCash: Num;
  totalDebt: Num;
  revenueGrowth: Num;
  expenseGrowth: Num;
  operatingMargin: Num;
  shortPercentOfFloat: Num;
  institutionalOwnership: Num;
  fiveYearReturn: Num;
  sp500FiveYearReturn: Num;
}

export function scoreQuantitative(i: QuantitativeInputs): Record<QuantitativeMetricId, Score | null> {
  return {
    cashVsDebt: scoreCashVsDebt(i.totalCash, i.totalDebt),
    revenueGrowth: scoreRevenueGrowth(i.revenueGrowth),
    operatingMargin: scoreOperatingMargin(i.operatingMargin),
    shortInterest: scoreShortInterest(i.shortPercentOfFloat),
    institutionalOwnership: scoreInstitutionalOwnership(i.institutionalOwnership),
    scalability: scoreScalability(i.revenueGrowth, i.expenseGrowth),
    fiveYearVsSp500: scoreFiveYearVsSp500(i.fiveYearReturn, i.sp500FiveYearReturn),
  };
}

export type Scores = Partial<Record<MetricId, Score | null>>;

export interface Total {
  points: number;
  /** Maximum reachable over the metrics that have a score. */
  outOf: number;
  scoredCount: number;
  /** points / outOf, or null when nothing is scored yet. */
  ratio: number | null;
}

export function totalScore(scores: Scores): Total {
  let points = 0;
  let scoredCount = 0;
  for (const m of METRICS) {
    const s = scores[m.id];
    if (s === null || s === undefined) continue;
    points += s;
    scoredCount += 1;
  }
  const outOf = scoredCount * MAX_METRIC_SCORE;
  return { points, outOf, scoredCount, ratio: outOf === 0 ? null : points / outOf };
}
