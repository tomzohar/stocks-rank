// A portfolio as data: target weights for a handful of stocks, the monthly DCA
// amount and starting amount they split, and the plan's notes and tips. Pure,
// so the money maths, parsing and validation are tested without a browser.
import { z } from "zod";

export const ROLES = ["Core", "Growth", "Defensive", "Satellite"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_TEXT: Record<Role, string> = {
  Core: "A steady, high-quality holding the portfolio is built around",
  Growth: "Bought for faster growth, with more swing",
  Defensive: "Holds up when the economy turns",
  Satellite: "A smaller, higher-risk bet",
};

export interface Holding {
  symbol: string;
  /** Target share of the portfolio, in percent. */
  weight: number;
  role: Role;
  /** Why it's there. */
  note: string;
}

export type PlanSource = "claude" | "score" | "demo";

/** What the builder's last step edits, and what a saved portfolio holds. */
export interface Plan {
  name: string;
  /** Dollars invested each month. */
  monthly: number;
  /** Dollars invested at the start; may be 0. */
  starting: number;
  holdings: Holding[];
  summary: string;
  /** How to put the starting amount to work. */
  startingPlan: string;
  /** How to split the monthly amount from month to month. */
  tips: string[];
  /** Who wrote the first draft: Claude, the score-weighted split, or offline demo data. */
  source: PlanSource;
  /** The model that answered, when Claude did. */
  model: string | null;
  createdAt: string;
}

export interface Portfolio extends Plan {
  id: string;
  savedAt: number;
  updatedAt: number;
}

export const MAX_HOLDINGS = 25;
export const MAX_PORTFOLIOS = 50;
/** Large enough for anyone; small enough that a typo of extra zeros is caught. */
export const MAX_AMOUNT = 100_000_000;

// ---- weights and money ----

export const weightTotal = (holdings: readonly Pick<Holding, "weight">[]) =>
  holdings.reduce((sum, h) => sum + (Number.isFinite(h.weight) && h.weight > 0 ? h.weight : 0), 0);

/** Each holding's share as a fraction summing to 1; equal shares when no weights are set. */
export function shares(holdings: readonly Pick<Holding, "weight">[]): number[] {
  const total = weightTotal(holdings);
  if (total <= 0) return holdings.map(() => (holdings.length ? 1 / holdings.length : 0));
  return holdings.map((h) => (Number.isFinite(h.weight) && h.weight > 0 ? h.weight / total : 0));
}

/**
 * Splits `total` units by `fractions` into whole units that add up to exactly
 * `total` (largest remainder: the rounding goes to the biggest leftovers).
 */
function largestRemainder(total: number, fractions: readonly number[]): number[] {
  const raw = fractions.map((f) => f * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rest: r - Math.floor(r) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) out[order[k].i]++;
  return out;
}

/** Splits a dollar amount by fractions into cents that add up to it exactly. */
export function splitAmount(amount: number, fractions: readonly number[]): number[] {
  if (!(amount > 0) || !fractions.length) return fractions.map(() => 0);
  const sum = fractions.reduce((a, b) => a + b, 0);
  if (sum <= 0) return fractions.map(() => 0);
  const cents = largestRemainder(Math.round(amount * 100), fractions.map((f) => f / sum));
  return cents.map((c) => c / 100);
}

/** Whole-percent weights that add up to 100, keeping the proportions. */
export function balanceWeights<T extends Pick<Holding, "weight">>(holdings: readonly T[]): T[] {
  const pct = largestRemainder(100, shares(holdings));
  return holdings.map((h, i) => ({ ...h, weight: pct[i] }));
}

/** Weights within half a point of 100 count as balanced. */
export const isBalanced = (holdings: readonly Pick<Holding, "weight">[]) => Math.abs(weightTotal(holdings) - 100) < 0.5;

/** Dollars of the starting and monthly amounts for each holding, by its share. */
export function allocate(plan: Pick<Plan, "holdings" | "monthly" | "starting">) {
  const s = shares(plan.holdings);
  const starting = splitAmount(plan.starting, s);
  const monthly = splitAmount(plan.monthly, s);
  return plan.holdings.map((h, i) => ({ symbol: h.symbol, share: s[i], starting: starting[i], monthly: monthly[i] }));
}

/** "$1,000", "1000", "1,250.50" → a non-negative amount, or null. */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n <= MAX_AMOUNT ? Math.round(n * 100) / 100 : null;
}

/** "$1,250" (whole dollars) or "$83.33". */
export function formatDollars(n: number): string {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(n);
}

// ---- storage ----

const holdingSchema = z.object({
  symbol: z.string().min(1).max(12),
  weight: z.number().min(0).max(100),
  role: z.enum(ROLES),
  note: z.string().max(2000),
});

export const planSchema = z.object({
  name: z.string().max(80),
  monthly: z.number().min(0).max(MAX_AMOUNT),
  starting: z.number().min(0).max(MAX_AMOUNT),
  holdings: z.array(holdingSchema).max(MAX_HOLDINGS),
  summary: z.string().max(4000),
  startingPlan: z.string().max(4000),
  tips: z.array(z.string().max(2000)).max(12),
  source: z.enum(["claude", "score", "demo"]),
  model: z.string().nullable(),
  createdAt: z.string(),
});

const portfolioSchema = planSchema.extend({ id: z.string().min(1).max(64), savedAt: z.number(), updatedAt: z.number() });
const storedList = z.object({ v: z.literal(1), portfolios: z.array(z.unknown()) });

/** The saved portfolios, newest first as stored; corrupt entries are skipped. */
export function parsePortfolios(raw: string | null): Portfolio[] {
  if (!raw) return [];
  try {
    const parsed = storedList.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    const out: Portfolio[] = [];
    for (const p of parsed.data.portfolios) {
      const one = portfolioSchema.safeParse(p);
      if (one.success && !out.some((x) => x.id === one.data.id)) out.push(one.data);
    }
    return out.slice(0, MAX_PORTFOLIOS);
  } catch {
    return [];
  }
}

export function serializePortfolios(list: readonly Portfolio[]): string {
  return JSON.stringify({ v: 1, portfolios: list });
}

/** Trims what people typed and drops empty tips, ready to save. */
export function cleanPlan(plan: Plan): Plan {
  return {
    ...plan,
    name: plan.name.trim() || "My Portfolio",
    summary: plan.summary.trim(),
    startingPlan: plan.startingPlan.trim(),
    tips: plan.tips.map((t) => t.trim()).filter(Boolean),
    holdings: plan.holdings.map((h) => ({ ...h, note: h.note.trim() })),
  };
}

/** Saves a new portfolio (first) or replaces one with the same id. */
export function upsertPortfolio(list: readonly Portfolio[], p: Portfolio): Portfolio[] {
  const i = list.findIndex((x) => x.id === p.id);
  if (i === -1) return [p, ...list].slice(0, MAX_PORTFOLIOS);
  const next = [...list];
  next[i] = p;
  return next;
}
