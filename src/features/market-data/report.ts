import "server-only";
import { cacheLife } from "next/cache";
import { demoFundamentals, demoHistory } from "./demo";
import type { StockFundamentals } from "./fundamentals";
import type { PriceHistory } from "./history";
import { fetchDailyHistory, fetchFundamentals } from "./yahoo";
import type { QuantitativeMetricId, Score } from "@/features/scoring/metrics";
import { scoreQuantitative } from "@/features/scoring/score";

export interface StockReport {
  fundamentals: StockFundamentals;
  scores: Record<QuantitativeMetricId, Score | null>;
}

/** Fundamentals plus the data-driven scores (metrics 1–7). Cached for an hour-ish. */
export async function getStockReport(symbol: string, name: string): Promise<StockReport> {
  "use cache";
  cacheLife("hours");
  const fundamentals =
    process.env.STOCKS_RANK_DATA === "demo" ? demoFundamentals(symbol, name) : await fetchFundamentals(symbol);
  return { fundamentals, scores: scoreQuantitative(fundamentals) };
}

/** Six years of daily candles for the chart tab. Cached like the report. */
export async function getPriceHistory(symbol: string, name: string): Promise<PriceHistory> {
  "use cache";
  cacheLife("hours");
  if (process.env.STOCKS_RANK_DATA === "demo") {
    return demoHistory(symbol, demoFundamentals(symbol, name).price ?? 100);
  }
  return fetchDailyHistory(symbol);
}
