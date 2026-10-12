import "server-only";
import { cacheLife } from "next/cache";
import { demoFundamentals } from "./data/demo";
import type { StockFundamentals } from "./data/fundamentals";
import { fetchFundamentals } from "./data/yahoo";
import type { QuantitativeMetricId, Score } from "./scoring/metrics";
import { scoreQuantitative } from "./scoring/score";

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
