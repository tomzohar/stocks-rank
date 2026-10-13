// The watchlist as data: an ordered list of symbols with when each was added.
// Pure, so ordering, undo and parsing are tested without a browser.
import { z } from "zod";

export interface WatchlistEntry {
  symbol: string;
  /** ms since epoch */
  addedAt: number;
}

export type WatchlistSort = "custom" | "score" | "symbol" | "added";

export const WATCHLIST_SORTS: { id: WatchlistSort; label: string }[] = [
  { id: "custom", label: "My Order" },
  { id: "score", label: "Score" },
  { id: "symbol", label: "Symbol" },
  { id: "added", label: "Recently Added" },
];

/** Every entry refreshes its market data, so keep the list a sensible size. */
export const MAX_WATCHLIST = 100;

const stored = z.object({
  v: z.literal(1),
  entries: z.array(z.object({ symbol: z.string().min(1).max(12), addedAt: z.number() })),
});

/** The saved list, or empty if missing or corrupt. Duplicates keep their first place. */
export function parseWatchlist(raw: string | null): WatchlistEntry[] {
  if (!raw) return [];
  try {
    const parsed = stored.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    const seen = new Set<string>();
    return parsed.data.entries
      .map((e) => ({ symbol: e.symbol.toUpperCase(), addedAt: e.addedAt }))
      .filter((e) => !seen.has(e.symbol) && seen.add(e.symbol))
      .slice(0, MAX_WATCHLIST);
  } catch {
    return [];
  }
}

export function serializeWatchlist(entries: readonly WatchlistEntry[]): string {
  return JSON.stringify({ v: 1, entries });
}

export const hasSymbol = (entries: readonly WatchlistEntry[], symbol: string) =>
  entries.some((e) => e.symbol === symbol);

/** Appends, like the iOS Stocks app; a no-op if present or full. */
export function addEntry(entries: readonly WatchlistEntry[], symbol: string, now: number): WatchlistEntry[] {
  if (hasSymbol(entries, symbol) || entries.length >= MAX_WATCHLIST) return [...entries];
  return [...entries, { symbol, addedAt: now }];
}

export function removeEntry(entries: readonly WatchlistEntry[], symbol: string): WatchlistEntry[] {
  return entries.filter((e) => e.symbol !== symbol);
}

/** Puts a removed entry back where it was (for undo). */
export function restoreEntry(entries: readonly WatchlistEntry[], entry: WatchlistEntry, index: number): WatchlistEntry[] {
  if (hasSymbol(entries, entry.symbol)) return [...entries];
  const next = [...entries];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, entry);
  return next;
}

/** Moves the entry at `from` to `to`, clamped to the list. */
export function moveEntry(entries: readonly WatchlistEntry[], from: number, to: number): WatchlistEntry[] {
  const next = [...entries];
  if (from < 0 || from >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

/**
 * The list in display order. `ratio` is a stock's share of available points,
 * or null when it has no score yet; unscored stocks sort last.
 */
export function sortEntries(
  entries: readonly WatchlistEntry[],
  sort: WatchlistSort,
  ratio: (symbol: string) => number | null,
): WatchlistEntry[] {
  const list = [...entries];
  switch (sort) {
    case "custom":
      return list;
    case "symbol":
      return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
    case "added":
      return list.sort((a, b) => b.addedAt - a.addedAt);
    case "score":
      return list.sort((a, b) => {
        const ra = ratio(a.symbol);
        const rb = ratio(b.symbol);
        if (ra === null || rb === null) return ra === rb ? 0 : ra === null ? 1 : -1;
        return rb - ra;
      });
  }
}

export function parseSort(raw: string | null): WatchlistSort {
  return WATCHLIST_SORTS.some((s) => s.id === raw) ? (raw as WatchlistSort) : "custom";
}
