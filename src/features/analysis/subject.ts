import { INDEX_LABELS, type Stock } from "@/features/universe/universe";
import type { AnalysisSubject } from "./types";

/** The stable company facts an analysis is keyed on. */
export function analysisSubject(stock: Stock): AnalysisSubject {
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    indexes: stock.indexes.map((i) => INDEX_LABELS[i]),
  };
}
