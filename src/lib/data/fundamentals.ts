// The market data a stock is scored on, and the pure helpers that derive it
// from raw statements and price history. No I/O here — see yahoo.ts for that.

/** Everything the report needs for one stock. Ratios are fractions. */
export interface StockFundamentals {
  symbol: string;
  name: string;
  currency: string | null;
  price: number | null;
  /** Currency the financial statements are reported in (may differ from `currency`). */
  financialCurrency: string | null;
  totalCash: number | null;
  totalDebt: number | null;
  revenueGrowth: number | null;
  expenseGrowth: number | null;
  /** Which fiscal years the growth figures compare, e.g. "FY2024 → FY2025". */
  growthPeriod: string | null;
  operatingMargin: number | null;
  shortPercentOfFloat: number | null;
  institutionalOwnership: number | null;
  fiveYearReturn: number | null;
  sp500FiveYearReturn: number | null;
  /** ISO timestamp of when the data was fetched. */
  asOf: string;
  /** "demo" marks generated offline data (STOCKS_RANK_DATA=demo) that must never pass for real. */
  source: "yahoo" | "demo";
}

/** One fiscal year of an income statement. */
export interface AnnualIncome {
  date: Date;
  totalRevenue?: number | null;
  totalExpenses?: number | null;
  operatingIncome?: number | null;
}

export interface GrowthComparison {
  revenueGrowth: number | null;
  expenseGrowth: number | null;
  period: string | null;
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function growth(from: number | null, to: number | null): number | null {
  if (!isNum(from) || !isNum(to) || from <= 0) return null;
  return to / from - 1;
}

function expensesOf(year: AnnualIncome): number | null {
  if (isNum(year.totalExpenses)) return year.totalExpenses;
  if (isNum(year.totalRevenue) && isNum(year.operatingIncome)) return year.totalRevenue - year.operatingIncome;
  return null;
}

/**
 * Year-over-year revenue and expense growth between the two most recent fiscal
 * years that report revenue. Both figures span the same years so that the
 * scalability metric compares like with like.
 */
export function latestAnnualGrowth(years: readonly AnnualIncome[]): GrowthComparison {
  const withRevenue = years
    .filter((y) => isNum(y.totalRevenue))
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());
  if (withRevenue.length < 2) return { revenueGrowth: null, expenseGrowth: null, period: null };
  const prior = withRevenue.at(-2)!;
  const latest = withRevenue.at(-1)!;
  return {
    revenueGrowth: growth(prior.totalRevenue ?? null, latest.totalRevenue ?? null),
    expenseGrowth: growth(expensesOf(prior), expensesOf(latest)),
    period: `FY${prior.date.getUTCFullYear()} → FY${latest.date.getUTCFullYear()}`,
  };
}

export interface PricePoint {
  date: Date;
  close?: number | null;
  /** Close adjusted for splits and dividends — preferred, as it captures total return. */
  adjclose?: number | null;
}

/** How late the first price may start before the window counts as incomplete (a monthly bar lags its period). */
const HISTORY_TOLERANCE_MS = 45 * 24 * 60 * 60 * 1000;

/**
 * Total return over the window starting at `from`, or null when the history
 * doesn't reach back that far (e.g. a recent IPO).
 */
export function periodReturn(points: readonly PricePoint[], from: Date): number | null {
  const priced = points
    .map((p) => ({ date: p.date, value: isNum(p.adjclose) ? p.adjclose : p.close }))
    .filter((p): p is { date: Date; value: number } => isNum(p.value) && p.value > 0)
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());
  if (priced.length < 2) return null;
  const first = priced[0];
  const last = priced.at(-1)!;
  if (first.date.getTime() - from.getTime() > HISTORY_TOLERANCE_MS) return null;
  return last.value / first.value - 1;
}

export function yearsAgo(years: number, now: Date): Date {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d;
}
