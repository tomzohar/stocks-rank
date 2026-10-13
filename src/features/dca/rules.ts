// The DCA system's four rules. Pure: no React, no I/O.
//
//   1. Up 50% on your average cost → trim 10% of the position.
//   2. Up 100% on your average cost → trim 20% of the position.
//   3. Down 20% or more from the 52-week high → double down (buy 2×).
//   4. Up 20% or more over the past month → buy half (0.5×).
//
// The buy multipliers stack, so a stock that is both 20% under its high and
// up 20% on the month (a sharp rebound) buys 2 × 0.5 = 1×.

export const DAY_MS = 86_400_000;

export const RULES = {
  trimSmall: { gain: 0.5, fraction: 0.1 },
  trimLarge: { gain: 1, fraction: 0.2 },
  dip: { drawdown: 0.2, multiplier: 2 },
  hot: { gain: 0.2, multiplier: 0.5 },
  /** Window for the 52-week high, in calendar days. */
  highWindowDays: 365,
  /** "A month" for rule 4, in calendar days. */
  monthDays: 30,
} as const;

export type BuyReason = "dip" | "hot";
export type TrimLevel = "small" | "large";

export interface BuySizing {
  multiplier: number;
  reasons: BuyReason[];
}

/**
 * How big the next scheduled buy should be. `drawdown` is how far the price
 * sits under its 52-week high (0.25 = 25% under); `monthChange` is the
 * one-month move (0.2 = up 20%). Either may be unknown.
 */
export function buySizing(drawdown: number | null, monthChange: number | null): BuySizing {
  const reasons: BuyReason[] = [];
  let multiplier = 1;
  if (drawdown !== null && drawdown >= RULES.dip.drawdown) {
    reasons.push("dip");
    multiplier *= RULES.dip.multiplier;
  }
  if (monthChange !== null && monthChange >= RULES.hot.gain) {
    reasons.push("hot");
    multiplier *= RULES.hot.multiplier;
  }
  return { multiplier, reasons };
}

/** The trim a gain on average cost calls for, the larger level winning. */
export function trimFor(gain: number | null): { level: TrimLevel; fraction: number } | null {
  if (gain === null) return null;
  if (gain >= RULES.trimLarge.gain) return { level: "large", fraction: RULES.trimLarge.fraction };
  if (gain >= RULES.trimSmall.gain) return { level: "small", fraction: RULES.trimSmall.fraction };
  return null;
}

/** "2×", "1×", "0.5×". */
export function formatMultiplier(m: number): string {
  return `${Number(m.toFixed(2))}×`;
}
