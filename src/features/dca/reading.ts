// Where a stock stands against the two buy rules today, for callers that need
// only the latest figures and not the chart. Pure: no React, no I/O.
import { computeSignals, type Bar } from "./series";

export interface DcaReading {
  price: number;
  /** Highest close of the past 52 weeks. */
  high: number;
  /** Fraction under that high: 0.25 = 25% under. */
  drawdown: number;
  /** Change over the past month (0.2 = up 20%), or null when the history is too short. */
  monthChange: number | null;
}

export function latestReading(bars: readonly Bar[]): DcaReading | null {
  if (!bars.length) return null;
  const s = computeSignals(bars);
  const i = bars.length - 1;
  return { price: bars[i].close, high: s.high[i].price, drawdown: s.drawdown[i], monthChange: s.monthChange[i] };
}
