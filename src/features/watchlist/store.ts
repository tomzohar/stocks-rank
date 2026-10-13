// The watchlist in this browser's localStorage, plus the last market data
// fetched for each stock on it. Nothing here leaves the device except the
// /api/stock requests for market data.
import { useMemo, useState, useSyncExternalStore } from "react";
import { getStoredAnalysisRaw, parseStoredAnalysis } from "@/features/analysis/browser-store";
import {
  notifyStorage,
  readStorage,
  STORAGE_PREFIX,
  subscribeStorage,
  writeStorage,
  writeStorageQuietly,
} from "@/lib/browser-storage";
import { isFresh, parseQuote, summarizeStock, type QuoteSnapshot, type StockSummary } from "./summary";
import {
  addEntry,
  moveEntry,
  parseSort,
  parseWatchlist,
  removeEntry,
  restoreEntry,
  serializeWatchlist,
  type WatchlistEntry,
  type WatchlistSort,
} from "./watchlist";

const LIST_KEY = `${STORAGE_PREFIX}watchlist`;
const SORT_KEY = `${STORAGE_PREFIX}watchlist-sort`;
const quoteKey = (symbol: string) => `${STORAGE_PREFIX}quote:${symbol}`;

// ---- the list ----

const getListRaw = () => readStorage("local", LIST_KEY);
const current = () => parseWatchlist(getListRaw());
const save = (entries: WatchlistEntry[]) => writeStorage("local", LIST_KEY, serializeWatchlist(entries));

/** What a removal took away, so it can be undone. */
export interface Removed {
  entry: WatchlistEntry;
  index: number;
  quote: string | null;
}

export function addToWatchlist(symbol: string) {
  save(addEntry(current(), symbol, Date.now()));
}

export function removeFromWatchlist(symbol: string): Removed | null {
  const list = current();
  const index = list.findIndex((e) => e.symbol === symbol);
  if (index === -1) return null;
  const quote = readStorage("local", quoteKey(symbol));
  writeStorageQuietly("local", quoteKey(symbol), null);
  save(removeEntry(list, symbol));
  return { entry: list[index], index, quote };
}

export function undoRemove(removed: Removed) {
  if (removed.quote) writeStorageQuietly("local", quoteKey(removed.entry.symbol), removed.quote);
  save(restoreEntry(current(), removed.entry, removed.index));
}

export function moveInWatchlist(from: number, to: number) {
  save(moveEntry(current(), from, to));
}

export function clearWatchlist() {
  for (const e of current()) writeStorageQuietly("local", quoteKey(e.symbol), null);
  save([]);
}

/** The saved list, or null until the browser has read it (on the server and during hydration). */
export function useWatchlist(): WatchlistEntry[] | null {
  const raw = useSyncExternalStore(subscribeStorage, getListRaw, () => undefined);
  return useMemo(() => (raw === undefined ? null : parseWatchlist(raw)), [raw]);
}

/** Whether a stock is on the list; null until known. */
export function useIsWatched(symbol: string): boolean | null {
  const list = useWatchlist();
  return list === null ? null : list.some((e) => e.symbol === symbol);
}

export function useWatchlistSort(): [WatchlistSort, (sort: WatchlistSort) => void] {
  const raw = useSyncExternalStore(subscribeStorage, () => readStorage("local", SORT_KEY), () => null);
  return [parseSort(raw), (sort) => writeStorage("local", SORT_KEY, sort === "custom" ? null : sort)];
}

// ---- market data for each row ----

const inFlight = new Map<string, Promise<void>>();
const failures = new Map<string, string>();

async function fetchQuote(symbol: string): Promise<void> {
  const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}`, { credentials: "same-origin" });
  const body = (await res.json().catch(() => null)) as { error?: string; fundamentals?: unknown; scores?: unknown } | null;
  if (!res.ok || !body?.fundamentals) throw new Error(body?.error ?? `Request failed (${res.status})`);
  const snapshot = { fetchedAt: Date.now(), fundamentals: body.fundamentals, scores: body.scores };
  const raw = JSON.stringify(snapshot);
  if (!parseQuote(raw)) throw new Error("Unexpected market data");
  writeStorageQuietly("local", quoteKey(symbol), raw);
}

/** Fetches one stock's market data and saves it. Concurrent calls share a request. */
export function refreshQuote(symbol: string): Promise<void> {
  const running = inFlight.get(symbol);
  if (running) return running;
  failures.delete(symbol);
  const run = fetchQuote(symbol)
    .catch((err: unknown) => {
      failures.set(symbol, navigator.onLine === false ? "Offline" : err instanceof Error ? err.message : String(err));
    })
    .finally(() => {
      inFlight.delete(symbol);
      notifyStorage();
    });
  inFlight.set(symbol, run);
  notifyStorage();
  return run;
}

/** Refreshes several stocks, a few at a time, skipping ones fetched recently unless `force`. */
export async function refreshQuotes(symbols: readonly string[], { force = false } = {}) {
  const now = Date.now();
  const due = symbols.filter((s) => force || !isFresh(parseQuote(readStorage("local", quoteKey(s))), now));
  let next = 0;
  const worker = async () => {
    while (next < due.length) await refreshQuote(due[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(4, due.length) }, worker));
}

export interface RowData {
  quote: QuoteSnapshot | null;
  summary: StockSummary | null;
  loading: boolean;
  error: string | null;
}

const SEP = "\u0001";

/**
 * Each stock's saved market data and cached Claude scores, plus whether it's
 * loading or failed. One string snapshot covers them all, so a change to any
 * row re-renders the list and nothing else does.
 */
export function useWatchlistRows(symbols: readonly string[]): Map<string, RowData> {
  const key = symbols.join(",");
  const snapshot = useSyncExternalStore(
    subscribeStorage,
    () =>
      symbols
        .map((s) =>
          [readStorage("local", quoteKey(s)) ?? "", getStoredAnalysisRaw(s) ?? "", inFlight.has(s) ? 1 : 0, failures.get(s) ?? ""].join(SEP),
        )
        .join("\n"),
    () => "",
  );
  const [readAt] = useState(() => Date.now());
  return useMemo(() => {
    const rows = new Map<string, RowData>();
    const parts = snapshot ? snapshot.split("\n") : [];
    (key ? key.split(",") : []).forEach((s, i) => {
      const [quoteRaw = "", analysisRaw = "", loading = "0", error = ""] = (parts[i] ?? "").split(SEP);
      const quote = parseQuote(quoteRaw || null);
      const analysis = parseStoredAnalysis(analysisRaw || null, readAt)?.analysis ?? null;
      rows.set(s, {
        quote,
        summary: quote ? summarizeStock(quote, analysis) : null,
        // No data and no error yet: about to be fetched.
        loading: loading === "1" || (!quote && !error),
        error: error || null,
      });
    });
    return rows;
  }, [snapshot, key, readAt]);
}
