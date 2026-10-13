// Today's call under the four rules, and the price levels that would change
// it. Pure: no React, no I/O.
import { buySizing, RULES, trimFor, type BuySizing, type TrimLevel } from "./rules";
import type { Bar, Signals } from "./series";

export type RuleId = "trimSmall" | "trimLarge" | "dip" | "hot";
export const RULE_ORDER: readonly RuleId[] = ["trimSmall", "trimLarge", "dip", "hot"];

export type Action = "trimLarge" | "trimSmall" | "double" | "half" | "offset" | "regular";

export interface RuleCheck {
  id: RuleId;
  /** null when the rule can't be judged yet: the trims need your average buy price. */
  triggered: boolean | null;
  /** The reading the rule compares: gain on cost, drawdown, or one-month change. */
  value: number | null;
  /** The price at which the rule fires, when one can be named. */
  triggerPrice: number | null;
}

export type LevelId = "high" | "dip" | "hot" | "avg" | "trimSmall" | "trimLarge";

export interface Level {
  id: LevelId;
  price: number;
}

export interface Advice {
  price: number;
  t: number;
  high: { price: number; t: number };
  drawdown: number;
  monthAgo: { price: number; t: number } | null;
  monthChange: number | null;
  avgCost: number | null;
  /** Gain on your average buy price: 0.5 = up 50%. */
  gain: number | null;
  sizing: BuySizing;
  trim: { level: TrimLevel; fraction: number } | null;
  action: Action;
  checks: RuleCheck[];
  /** Price levels worth a line on the chart, high to low. */
  levels: Level[];
}

function actionFor(sizing: BuySizing, trim: Advice["trim"]): Action {
  if (trim) return trim.level === "large" ? "trimLarge" : "trimSmall";
  if (sizing.reasons.length === 2) return "offset";
  if (sizing.reasons[0] === "dip") return "double";
  if (sizing.reasons[0] === "hot") return "half";
  return "regular";
}

/** The rules applied to the latest close. `avgCost` is the viewer's average buy price, if they gave one. */
export function adviseLatest(bars: readonly Bar[], signals: Signals, avgCost: number | null): Advice | null {
  const i = bars.length - 1;
  if (i < 0) return null;
  const bar = bars[i];
  const high = signals.high[i];
  const drawdown = signals.drawdown[i];
  const m = signals.monthAgo[i];
  const monthAgo = m === null ? null : { price: bars[m].close, t: bars[m].t };
  const monthChange = signals.monthChange[i];
  const cost = avgCost !== null && avgCost > 0 ? avgCost : null;
  const gain = cost === null ? null : bar.close / cost - 1;
  const sizing = buySizing(drawdown, monthChange);
  const trim = trimFor(gain);

  const dipPrice = high.price * (1 - RULES.dip.drawdown);
  const hotPrice = monthAgo ? monthAgo.price * (1 + RULES.hot.gain) : null;
  const trimSmallPrice = cost === null ? null : cost * (1 + RULES.trimSmall.gain);
  const trimLargePrice = cost === null ? null : cost * (1 + RULES.trimLarge.gain);

  const checks: RuleCheck[] = [
    { id: "trimSmall", triggered: gain === null ? null : gain >= RULES.trimSmall.gain, value: gain, triggerPrice: trimSmallPrice },
    { id: "trimLarge", triggered: gain === null ? null : gain >= RULES.trimLarge.gain, value: gain, triggerPrice: trimLargePrice },
    { id: "dip", triggered: sizing.reasons.includes("dip"), value: drawdown, triggerPrice: dipPrice },
    { id: "hot", triggered: sizing.reasons.includes("hot"), value: monthChange, triggerPrice: hotPrice },
  ];

  const levels: Level[] = [
    { id: "high" as const, price: high.price },
    { id: "dip" as const, price: dipPrice },
    ...(hotPrice === null ? [] : [{ id: "hot" as const, price: hotPrice }]),
    ...(cost === null
      ? []
      : [
          { id: "avg" as const, price: cost },
          { id: "trimSmall" as const, price: trimSmallPrice! },
          { id: "trimLarge" as const, price: trimLargePrice! },
        ]),
  ].toSorted((a, b) => b.price - a.price);

  return {
    price: bar.close,
    t: bar.t,
    high: { price: high.price, t: bars[high.i].t },
    drawdown,
    monthAgo,
    monthChange,
    avgCost: cost,
    gain,
    sizing,
    trim,
    action: actionFor(sizing, trim),
    checks,
    levels,
  };
}

/** Parses a typed price ("$1,234.50", "98.2") into a positive number, or null. */
export function parsePriceInput(text: string): number | null {
  const cleaned = text.replace(/[\s$,]/g, "");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}
