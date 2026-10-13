import { describe, expect, it } from "vitest";
import {
  addEntry,
  MAX_WATCHLIST,
  moveEntry,
  parseSort,
  parseWatchlist,
  removeEntry,
  restoreEntry,
  serializeWatchlist,
  sortEntries,
  type WatchlistEntry,
} from "./watchlist";

const list: WatchlistEntry[] = [
  { symbol: "NVDA", addedAt: 1 },
  { symbol: "AAPL", addedAt: 3 },
  { symbol: "MSFT", addedAt: 2 },
];
const symbols = (l: WatchlistEntry[]) => l.map((e) => e.symbol);

describe("parseWatchlist", () => {
  it("round-trips", () => {
    expect(parseWatchlist(serializeWatchlist(list))).toEqual(list);
  });

  it("ignores missing, corrupt or unknown-version data", () => {
    expect(parseWatchlist(null)).toEqual([]);
    expect(parseWatchlist("{nope")).toEqual([]);
    expect(parseWatchlist(JSON.stringify({ v: 2, entries: list }))).toEqual([]);
    expect(parseWatchlist(JSON.stringify({ v: 1, entries: [{ symbol: 5 }] }))).toEqual([]);
  });

  it("drops duplicates and normalises case", () => {
    const raw = JSON.stringify({ v: 1, entries: [{ symbol: "aapl", addedAt: 1 }, { symbol: "AAPL", addedAt: 2 }] });
    expect(parseWatchlist(raw)).toEqual([{ symbol: "AAPL", addedAt: 1 }]);
  });
});

describe("editing", () => {
  it("appends new symbols once", () => {
    expect(symbols(addEntry(list, "COST", 9))).toEqual(["NVDA", "AAPL", "MSFT", "COST"]);
    expect(addEntry(list, "AAPL", 9)).toEqual(list);
  });

  it("stops at the size limit", () => {
    const full = Array.from({ length: MAX_WATCHLIST }, (_, i) => ({ symbol: `S${i}`, addedAt: i }));
    expect(addEntry(full, "COST", 1)).toHaveLength(MAX_WATCHLIST);
  });

  it("removes and restores to the same place", () => {
    const removed = removeEntry(list, "AAPL");
    expect(symbols(removed)).toEqual(["NVDA", "MSFT"]);
    expect(restoreEntry(removed, list[1], 1)).toEqual(list);
    expect(symbols(restoreEntry(removed, list[1], 99))).toEqual(["NVDA", "MSFT", "AAPL"]);
  });

  it("moves entries, clamped to the list", () => {
    expect(symbols(moveEntry(list, 0, 2))).toEqual(["AAPL", "MSFT", "NVDA"]);
    expect(symbols(moveEntry(list, 2, 0))).toEqual(["MSFT", "NVDA", "AAPL"]);
    expect(symbols(moveEntry(list, 1, 50))).toEqual(["NVDA", "MSFT", "AAPL"]);
    expect(moveEntry(list, 7, 0)).toEqual(list);
  });
});

describe("sortEntries", () => {
  const ratios: Record<string, number | null> = { NVDA: 0.5, AAPL: null, MSFT: 0.8 };
  const ratio = (s: string) => ratios[s] ?? null;

  it("keeps my order, or sorts by symbol, recency or score", () => {
    expect(symbols(sortEntries(list, "custom", ratio))).toEqual(["NVDA", "AAPL", "MSFT"]);
    expect(symbols(sortEntries(list, "symbol", ratio))).toEqual(["AAPL", "MSFT", "NVDA"]);
    expect(symbols(sortEntries(list, "added", ratio))).toEqual(["AAPL", "MSFT", "NVDA"]);
    expect(symbols(sortEntries(list, "score", ratio))).toEqual(["MSFT", "NVDA", "AAPL"]);
  });

  it("does not reorder the saved list", () => {
    sortEntries(list, "symbol", ratio);
    expect(symbols(list)).toEqual(["NVDA", "AAPL", "MSFT"]);
  });

  it("falls back to my order for an unknown sort", () => {
    expect(parseSort("score")).toBe("score");
    expect(parseSort("price")).toBe("custom");
    expect(parseSort(null)).toBe("custom");
  });
});
