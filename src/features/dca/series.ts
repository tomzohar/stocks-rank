// Rolling figures the rules read, computed once over a whole price history.
// Pure: no React, no I/O.
import { DAY_MS, RULES } from "./rules";

/** One daily close. `t` is the bar's timestamp in ms. */
export interface Bar {
  t: number;
  close: number;
}

export interface Signals {
  /** Highest close in the trailing 52 weeks, and the bar it was on. */
  high: { price: number; i: number }[];
  /** Fraction under that high: 0.25 = 25% under. */
  drawdown: number[];
  /** Index of the close about a month earlier, or null when the history doesn't reach back. */
  monthAgo: (number | null)[];
  /** Change since then: 0.2 = up 20%. */
  monthChange: (number | null)[];
}

/** A missing month-ago close may lag the target by this much (weekends, holidays, gaps). */
const MONTH_TOLERANCE_MS = 7 * DAY_MS;

export function computeSignals(bars: readonly Bar[]): Signals {
  const high: Signals["high"] = [];
  const drawdown: number[] = [];
  const monthAgo: (number | null)[] = [];
  const monthChange: (number | null)[] = [];
  const windowMs = RULES.highWindowDays * DAY_MS;
  const monthMs = RULES.monthDays * DAY_MS;

  // Monotonic deque of indexes with falling closes: the front is the window's high.
  const deque: number[] = [];
  let head = 0;
  // Last bar at or before t - a month.
  let j = -1;

  bars.forEach((bar, i) => {
    while (deque.length > head && bars[deque.at(-1)!].close <= bar.close) deque.pop();
    deque.push(i);
    while (bars[deque[head]].t < bar.t - windowMs) head++;
    const top = bars[deque[head]];
    high.push({ price: top.close, i: deque[head] });
    drawdown.push(top.close > 0 ? 1 - bar.close / top.close : 0);

    const target = bar.t - monthMs;
    while (j + 1 < i && bars[j + 1].t <= target) j++;
    const ok = j >= 0 && target - bars[j].t <= MONTH_TOLERANCE_MS;
    monthAgo.push(ok ? j : null);
    monthChange.push(ok && bars[j].close > 0 ? bar.close / bars[j].close - 1 : null);
  });
  return { high, drawdown, monthAgo, monthChange };
}

/** Contiguous runs of `true`, as inclusive index ranges. */
export function runs(flags: readonly boolean[]): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  flags.forEach((on, i) => {
    if (!on) return;
    const last = out.at(-1);
    if (last && last.to === i - 1) last.to = i;
    else out.push({ from: i, to: i });
  });
  return out;
}

/** First bar on or after `t`. */
export function indexAtOrAfter(bars: readonly Bar[], t: number): number {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, Math.max(0, bars.length - 1));
}
