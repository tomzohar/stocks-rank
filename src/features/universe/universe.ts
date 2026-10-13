// The stocks a user can pick: the S&P 500 ∪ Nasdaq-100.
// Regenerate the list with `npm run universe`.
import universe from "./data/universe.json";

export type IndexId = "SP500" | "NDX";

export interface Stock {
  symbol: string;
  name: string;
  sector: string | null;
  indexes: IndexId[];
}

export const INDEX_LABELS: Record<IndexId, string> = { SP500: "S&P 500", NDX: "Nasdaq-100" };

export const STOCKS = universe.stocks as Stock[];
export const UNIVERSE_DATE = universe.generatedAt;

const bySymbol = new Map(STOCKS.map((s) => [s.symbol, s]));

/** Looks a symbol up case-insensitively; accepts "BRK.B" for "BRK-B". */
export function findStock(symbol: string): Stock | undefined {
  return bySymbol.get(symbol.trim().toUpperCase().replace(/\./g, "-"));
}

/**
 * Ranks stocks against a free-text query: exact symbol, then symbol prefix,
 * then name prefix, then name/word contains. Ties keep alphabetical order.
 */
export function searchStocks(
  query: string,
  { stocks = STOCKS, index, limit = 50 }: { stocks?: readonly Stock[]; index?: IndexId; limit?: number } = {},
): Stock[] {
  const pool = index ? stocks.filter((s) => s.indexes.includes(index)) : stocks;
  const q = query.trim().toUpperCase().replace(/\./g, "-");
  if (!q) return pool.slice(0, limit);

  const ranked: { stock: Stock; rank: number }[] = [];
  for (const stock of pool) {
    const name = stock.name.toUpperCase();
    let rank: number;
    if (stock.symbol === q) rank = 0;
    else if (stock.symbol.startsWith(q)) rank = 1;
    else if (name.startsWith(q)) rank = 2;
    else if (name.includes(` ${q}`)) rank = 3;
    else if (name.includes(q)) rank = 4;
    else continue;
    ranked.push({ stock, rank });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.stock.symbol.localeCompare(b.stock.symbol))
    .slice(0, limit)
    .map((r) => r.stock);
}
