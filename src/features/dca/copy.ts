// Words for the DCA tab: the call, why, and what to watch. Pure, so the
// wording is tested alongside the numbers it describes.
import { formatPercent, formatPrice } from "@/lib/format";
import type { Tone } from "@/ui/tone";
import type { Advice, LevelId, RuleCheck, RuleId } from "./advice";
import type { KeyPoint, KeyPointKind } from "./keypoints";
import { FOLLOW_UP_DAYS } from "./keypoints";
import { formatMultiplier, RULES } from "./rules";

export type Fmt = (n: number) => string;
export const priceFormatter = (currency: string | null): Fmt => (n) => formatPrice(n, currency);
const pct = (n: number) => formatPercent(n);
const signed = (n: number) => formatPercent(n, { signed: true });
/** Rule thresholds read better whole: "50%", not "50.0%". */
const whole = (n: number) => `${Math.round(n * 100)}%`;

/** "Mar 4, 2025", in UTC so server and browser agree. */
export function formatDay(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export interface ActionCopy {
  title: string;
  detail: string;
  tone: Tone;
  /** The size of the next scheduled buy, when it isn't the headline. */
  nextBuy: string | null;
}

export function actionCopy(a: Advice, symbol: string, fmt: Fmt): ActionCopy {
  const nextBuy = a.trim ? `Next buy: ${formatMultiplier(a.sizing.multiplier)}` : null;
  const gainLine = (line: string) =>
    `You're up ${pct(a.gain ?? 0)} on your ${fmt(a.avgCost ?? 0)} average, past the ${line} line.`;
  switch (a.action) {
    case "trimLarge":
      return { title: "Trim 20%", detail: `${gainLine("+100%")} Sell a fifth of the position.`, tone: "critical", nextBuy };
    case "trimSmall":
      return { title: "Trim 10%", detail: `${gainLine("+50%")} Sell a tenth of the position.`, tone: "critical", nextBuy };
    case "double":
      return {
        title: "Double down",
        detail: `${symbol} is ${pct(a.drawdown)} under its 52-week high of ${fmt(a.high.price)}. Make your next buy twice the usual amount.`,
        tone: "good",
        nextBuy,
      };
    case "half":
      return {
        title: "Buy half",
        detail: `${symbol} is up ${pct(a.monthChange ?? 0)} over the past month. Make your next buy half the usual amount.`,
        tone: "warning",
        nextBuy,
      };
    case "offset":
      return {
        title: "Buy as usual",
        detail: `Both buy rules fire: ${pct(a.drawdown)} under the high (2×) and up ${pct(a.monthChange ?? 0)} this month (0.5×). They cancel out to your usual amount.`,
        tone: "neutral",
        nextBuy,
      };
    case "regular":
      return { title: "Buy as usual", detail: "No rule fires today. Keep your regular amount (1×).", tone: "neutral", nextBuy };
  }
}

export const RULE_TEXT: Record<RuleId, { when: string; then: string }> = {
  trimSmall: { when: `Up ${whole(RULES.trimSmall.gain)} on your average`, then: `Trim ${whole(RULES.trimSmall.fraction)}` },
  trimLarge: { when: `Up ${whole(RULES.trimLarge.gain)} on your average`, then: `Trim ${whole(RULES.trimLarge.fraction)}` },
  dip: { when: `${whole(RULES.dip.drawdown)} under the 52-week high`, then: `Buy ${formatMultiplier(RULES.dip.multiplier)}` },
  hot: { when: `Up ${whole(RULES.hot.gain)} in a month`, then: `Buy ${formatMultiplier(RULES.hot.multiplier)}` },
};

export interface CheckCopy {
  status: "Fires now" | "Not now" | "Needs your price" | "No data";
  tone: Tone;
  reading: string;
}

/** How far the price must move to reach `target`, as "12.3% higher". */
function distance(price: number, target: number): string {
  const d = target / price - 1;
  return `${pct(Math.abs(d))} ${d >= 0 ? "higher" : "lower"}`;
}

export function checkCopy(c: RuleCheck, a: Advice, fmt: Fmt): CheckCopy {
  const fire = (tone: Tone, reading: string): CheckCopy => ({ status: "Fires now", tone, reading });
  const wait = (reading: string): CheckCopy => ({ status: "Not now", tone: "neutral", reading });
  switch (c.id) {
    case "trimSmall":
    case "trimLarge": {
      if (c.triggered === null || c.triggerPrice === null || a.gain === null) {
        return { status: "Needs your price", tone: "neutral", reading: "Add your average buy price to check this rule." };
      }
      const now = `${a.gain >= 0 ? "Up" : "Down"} ${pct(Math.abs(a.gain))} on ${fmt(a.avgCost!)}`;
      return c.triggered
        ? fire("critical", `${now}, past ${fmt(c.triggerPrice)}.`)
        : wait(`${now}. Fires at ${fmt(c.triggerPrice)}, ${distance(a.price, c.triggerPrice)}.`);
    }
    case "dip": {
      const now = `${pct(a.drawdown)} under the ${fmt(a.high.price)} high`;
      return c.triggered
        ? fire("good", `${now}, below ${fmt(c.triggerPrice!)}.`)
        : wait(`${now}. Fires below ${fmt(c.triggerPrice!)}, ${distance(a.price, c.triggerPrice!)}.`);
    }
    case "hot": {
      if (a.monthAgo === null || a.monthChange === null || c.triggerPrice === null) {
        return { status: "No data", tone: "neutral", reading: "Not enough price history for a one-month change." };
      }
      const now = `${signed(a.monthChange)} since ${formatDay(a.monthAgo.t)} (${fmt(a.monthAgo.price)})`;
      return c.triggered
        ? fire("warning", `${now}.`)
        : wait(`${now}. Fires above ${fmt(c.triggerPrice)}, ${distance(a.price, c.triggerPrice)}.`);
    }
  }
}

export const LEVEL_TEXT: Record<LevelId, { label: string; note: string }> = {
  trimLarge: { label: "Trim 20%", note: "+100% on your average" },
  trimSmall: { label: "Trim 10%", note: "+50% on your average" },
  high: { label: "52-week high", note: "Closing high" },
  hot: { label: "Buy 0.5× above", note: "+20% on the close a month ago" },
  avg: { label: "Your average", note: "Your average buy price" },
  dip: { label: "Buy 2× below", note: "20% under the 52-week high" },
};

export const KEY_POINT_LABEL: Record<KeyPointKind, string> = {
  high: "52W high",
  dip: "2×",
  hot: "0.5×",
  trimSmall: "Trim 10%",
  trimLarge: "Trim 20%",
};

export function keyPointCopy(p: KeyPoint, fmt: Fmt): { title: string; detail: string } {
  const when = `${formatDay(p.t)} at ${fmt(p.price)}`;
  const after = p.after
    ? ` ${p.after.days >= FOLLOW_UP_DAYS - 7 ? "Three months later" : `${p.after.days} days later`}: ${signed(p.after.change)}.`
    : "";
  switch (p.kind) {
    case "high":
      return {
        title: `52-week high, ${fmt(p.price)}`,
        detail: `${formatDay(p.t)}. The double-down zone starts 20% below it, at ${fmt(p.price * (1 - RULES.dip.drawdown))}.`,
      };
    case "dip":
      return {
        title: "Fell 20% under its high",
        detail: `${when}; the bottom was ${pct(p.value ?? 0)} under the high. Buys doubled.${after}`,
      };
    case "hot":
      return { title: `Up ${pct(p.value ?? 0)} in a month`, detail: `${when}. Buys halved.${after}` };
    case "trimSmall":
      return { title: "Crossed +50% on your average", detail: `${when}. A 10% trim.` };
    case "trimLarge":
      return { title: "Crossed +100% on your average", detail: `${when}. A 20% trim.` };
  }
}
