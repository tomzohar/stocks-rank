// This month's buys: each holding's share of the monthly amount, resized by
// the DCA chart's buy rules (2× at 20%+ under the 52-week high, 0.5× after a
// 20% month). Pure.
import type { DcaReading } from "@/features/dca/reading";
import { buySizing, type BuyReason } from "@/features/dca/rules";
import { shares, splitAmount, type Holding } from "./model";

export interface MonthlyBuy {
  symbol: string;
  /** The holding's regular monthly amount, by weight. */
  base: number;
  multiplier: number;
  reasons: BuyReason[];
  /** What to buy this month. */
  amount: number;
  /** False when there was no price reading, so the rules couldn't run (1×). */
  known: boolean;
}

/**
 * With `fit`, the resized buys are scaled back to the monthly amount, so a
 * 2× buy is paid for by smaller buys elsewhere; without it, they may add up
 * to more or less than the monthly amount.
 */
export function monthlyBuys(
  holdings: readonly Holding[],
  monthly: number,
  readings: ReadonlyMap<string, DcaReading | null>,
  { fit }: { fit: boolean },
): { buys: MonthlyBuy[]; total: number } {
  const base = splitAmount(monthly, shares(holdings));
  const sized = holdings.map((h, i) => {
    const r = readings.get(h.symbol) ?? null;
    const { multiplier, reasons } = r ? buySizing(r.drawdown, r.monthChange) : { multiplier: 1, reasons: [] };
    return { symbol: h.symbol, base: base[i], multiplier, reasons, known: r !== null, raw: base[i] * multiplier };
  });
  const rawTotal = sized.reduce((a, b) => a + b.raw, 0);
  const amounts =
    fit && rawTotal > 0
      ? splitAmount(monthly, sized.map((s) => s.raw))
      : splitAmount(rawTotal, sized.map((s) => s.raw));
  const buys = sized.map((s, i) => ({
    symbol: s.symbol,
    base: s.base,
    multiplier: s.multiplier,
    reasons: s.reasons,
    amount: amounts[i],
    known: s.known,
  }));
  return { buys, total: Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100 };
}
