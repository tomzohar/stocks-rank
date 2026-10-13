// The moments on the chart worth pointing out: where the rules fired before,
// and how those calls played out. Pure: no React, no I/O.
import { DAY_MS, RULES } from "./rules";
import { runs, type Bar, type Signals } from "./series";

export type KeyPointKind = "high" | "dip" | "hot" | "trimSmall" | "trimLarge";

export interface KeyPoint {
  kind: KeyPointKind;
  /** Index of the bar it marks. */
  i: number;
  t: number;
  price: number;
  /** dip: deepest drawdown in that stretch. hot: biggest one-month gain. trims: gain on cost. */
  value: number | null;
  /** dip and hot: change from this close to about three months later (or today, if sooner). */
  after: { change: number; days: number } | null;
}

/** How far ahead "how did it play out" looks. */
export const FOLLOW_UP_DAYS = 91;
/** Older stretches of the same kind are dropped beyond this many. */
const MAX_PER_KIND = 3;

function followUp(bars: readonly Bar[], i: number): KeyPoint["after"] {
  const target = bars[i].t + FOLLOW_UP_DAYS * DAY_MS;
  let j = i;
  while (j + 1 < bars.length && bars[j + 1].t <= target) j++;
  if (j === i) return null;
  return { change: bars[j].close / bars[i].close - 1, days: Math.round((bars[j].t - bars[i].t) / DAY_MS) };
}

/**
 * Key points from bar `from` to the end: the current 52-week high, each time
 * the price fell into the double-down zone or ran up 20% in a month, and,
 * given an average buy price, each time it crossed a trim level.
 */
export function keyPoints(bars: readonly Bar[], signals: Signals, from: number, avgCost: number | null): KeyPoint[] {
  if (!bars.length) return [];
  const last = bars.length - 1;
  const points: KeyPoint[] = [];
  const inRange = (i: number) => i >= from && i <= last;
  const latest = <T>(xs: T[]) => xs.slice(-MAX_PER_KIND);

  const hi = signals.high[last].i;
  if (inRange(hi)) points.push({ kind: "high", i: hi, t: bars[hi].t, price: bars[hi].close, value: null, after: null });

  const dips = runs(signals.drawdown.map((d, i) => i >= from && d >= RULES.dip.drawdown));
  for (const r of latest(dips)) {
    const depth = Math.max(...signals.drawdown.slice(r.from, r.to + 1));
    points.push({ kind: "dip", i: r.from, t: bars[r.from].t, price: bars[r.from].close, value: depth, after: followUp(bars, r.from) });
  }

  const hots = runs(signals.monthChange.map((c, i) => i >= from && c !== null && c >= RULES.hot.gain));
  for (const r of latest(hots)) {
    const peak = Math.max(...signals.monthChange.slice(r.from, r.to + 1).map((c) => c ?? 0));
    points.push({ kind: "hot", i: r.from, t: bars[r.from].t, price: bars[r.from].close, value: peak, after: followUp(bars, r.from) });
  }

  if (avgCost !== null && avgCost > 0) {
    for (const kind of ["trimSmall", "trimLarge"] as const) {
      const level = avgCost * (1 + RULES[kind].gain);
      const crossings: number[] = [];
      for (let i = Math.max(from, 1); i <= last; i++) {
        if (bars[i - 1].close < level && bars[i].close >= level) crossings.push(i);
      }
      // With no earlier bar to cross from, the very first one counts if it's already above.
      if (from === 0 && bars[0].close >= level) crossings.unshift(0);
      for (const i of latest(crossings)) {
        points.push({ kind, i, t: bars[i].t, price: bars[i].close, value: bars[i].close / avgCost - 1, after: null });
      }
    }
  }
  return points.toSorted((a, b) => a.t - b.t || a.kind.localeCompare(b.kind));
}
