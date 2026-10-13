// Daily price history for the chart tab, and the pure helper that cleans
// Yahoo's bars into it. No I/O here — see yahoo.ts for that.

/** One trading day. `t` is the bar's timestamp in ms. */
export interface Candle {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PriceHistory {
  symbol: string;
  currency: string | null;
  /** Oldest first, one per trading day. */
  candles: Candle[];
  asOf: string;
  source: "yahoo" | "demo";
}

/** Years of daily bars fetched: five to show, plus one so the 52-week high is known from the first. */
export const HISTORY_YEARS = 6;

export interface RawBar {
  date: Date;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
}

const isPos = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const round = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Drops bars without a close, fills a missing open/high/low from the close,
 * and keeps the last bar of any day reported twice (Yahoo repeats today's).
 */
export function toCandles(raw: readonly RawBar[]): Candle[] {
  const byDay = new Map<string, Candle>();
  for (const b of raw) {
    if (!isPos(b.close)) continue;
    const close = b.close;
    const open = isPos(b.open) ? b.open : close;
    const high = Math.max(isPos(b.high) ? b.high : close, open, close);
    const low = Math.min(isPos(b.low) ? b.low : close, open, close);
    const t = b.date.getTime();
    byDay.set(new Date(t).toISOString().slice(0, 10), { t, open: round(open), high: round(high), low: round(low), close: round(close) });
  }
  return [...byDay.values()].toSorted((a, b) => a.t - b.t);
}
