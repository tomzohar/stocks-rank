// Candles for the chart: daily as fetched, or rolled up into months. Pure.
import type { Bar } from "./series";

export interface Candle extends Bar {
  open: number;
  high: number;
  low: number;
}

export type Interval = "daily" | "monthly";

/** "2025-03-14" for a bar's UTC day; the chart's business-day key. */
export function dayKey(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** "2025-03-01": the month a bar falls in. */
export function monthKey(t: number): string {
  return `${dayKey(t).slice(0, 7)}-01`;
}

export const bucketKey = (interval: Interval, t: number) => (interval === "monthly" ? monthKey(t) : dayKey(t));

/** One candle per calendar month: first open, highest high, lowest low, last close. */
export function toMonthly(daily: readonly Candle[]): (Candle & { key: string })[] {
  const out: (Candle & { key: string })[] = [];
  for (const c of daily) {
    const key = monthKey(c.t);
    const last = out.at(-1);
    if (last && last.key === key) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
    } else {
      out.push({ key, t: c.t, open: c.open, high: c.high, low: c.low, close: c.close });
    }
  }
  return out;
}
