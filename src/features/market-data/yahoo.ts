// Fetches StockFundamentals from Yahoo Finance via yahoo-finance2 (no API key).
// Server-only: Yahoo blocks browser requests (CORS), and the client needs a
// cookie + crumb that yahoo-finance2 manages.
import "server-only";
import YahooFinance from "yahoo-finance2";
import {
  latestAnnualGrowth,
  periodReturn,
  yearsAgo,
  type AnnualIncome,
  type StockFundamentals,
} from "./fundamentals";
import { HISTORY_YEARS, toCandles, type PriceHistory } from "./history";

/** Benchmark for the 5-year comparison. SPY's adjusted close tracks the S&P 500's total return. */
export const SP500_BENCHMARK = "SPY";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function fiveYearReturn(symbol: string, now: Date): Promise<number | null> {
  const from = yearsAgo(5, now);
  const chart = await yahooFinance.chart(symbol, { period1: from, period2: now, interval: "1mo" });
  return periodReturn(chart.quotes, from);
}

async function annualIncome(symbol: string, now: Date): Promise<AnnualIncome[]> {
  const rows = await yahooFinance.fundamentalsTimeSeries(symbol, {
    period1: yearsAgo(4, now),
    period2: now,
    type: "annual",
    module: "financials",
  });
  return rows.map((r) => {
    const row = r as AnnualIncome;
    return {
      date: row.date,
      totalRevenue: row.totalRevenue,
      totalExpenses: row.totalExpenses,
      operatingIncome: row.operatingIncome,
    };
  });
}

/** Resolves to null for a failed optional lookup instead of failing the whole report. */
async function optional<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export async function fetchFundamentals(symbol: string, now = new Date()): Promise<StockFundamentals> {
  const [summary, income, stock5y, sp5y] = await Promise.all([
    yahooFinance.quoteSummary(symbol, { modules: ["price", "financialData", "defaultKeyStatistics"] }),
    optional(annualIncome(symbol, now)),
    optional(fiveYearReturn(symbol, now)),
    optional(fiveYearReturn(SP500_BENCHMARK, now)),
  ]);
  const { price, financialData: fin, defaultKeyStatistics: stats } = summary;
  const growth = latestAnnualGrowth(income ?? []);

  return {
    symbol,
    name: price?.longName ?? price?.shortName ?? symbol,
    currency: price?.currency ?? null,
    price: price?.regularMarketPrice ?? null,
    financialCurrency: fin?.financialCurrency ?? null,
    totalCash: fin?.totalCash ?? null,
    totalDebt: fin?.totalDebt ?? null,
    // Annual statements first; Yahoo's quarterly YoY figure if they're unavailable.
    revenueGrowth: growth.revenueGrowth ?? fin?.revenueGrowth ?? null,
    expenseGrowth: growth.revenueGrowth === null ? null : growth.expenseGrowth,
    growthPeriod: growth.revenueGrowth === null ? (fin?.revenueGrowth != null ? "Latest quarter, YoY" : null) : growth.period,
    operatingMargin: fin?.operatingMargins ?? null,
    shortPercentOfFloat: stats?.shortPercentOfFloat ?? null,
    institutionalOwnership: stats?.heldPercentInstitutions ?? null,
    fiveYearReturn: stock5y,
    sp500FiveYearReturn: sp5y,
    asOf: now.toISOString(),
    source: "yahoo",
  };
}

/** Daily bars for the chart tab. Yahoo's closes here are split-adjusted, not dividend-adjusted. */
export async function fetchDailyHistory(symbol: string, now = new Date()): Promise<PriceHistory> {
  const chart = await yahooFinance.chart(symbol, { period1: yearsAgo(HISTORY_YEARS, now), period2: now, interval: "1d" });
  return {
    symbol,
    currency: chart.meta.currency ?? null,
    candles: toCandles(chart.quotes),
    asOf: now.toISOString(),
    source: "yahoo",
  };
}
