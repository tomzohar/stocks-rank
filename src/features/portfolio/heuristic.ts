// The no-Claude versions of both steps: picks by the selection rules, and a
// plan weighted by score. They serve offline demo data (labelled as such), and
// anyone who'd rather not use a key. Pure.
import { byScore, DEFAULT_RULES, selectByRules, type Candidate } from "./candidates";
import { allocate, balanceWeights, formatDollars, type Holding, type Plan, type Role } from "./model";
import type { PickRequest, PickResult } from "./prompt";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The best-scoring stocks with at most two per sector, for demo data. */
export function demoPicks(req: PickRequest): PickResult {
  const limit = req.count ?? Math.min(6, req.candidates.length);
  const { picked } = selectByRules(req.candidates, { ...DEFAULT_RULES, minGrade: "any", maxPerSector: 2, limit });
  return {
    picks: picked.map((c) => ({
      symbol: c.symbol,
      reason: `Graded ${c.grade?.label ?? "n/a"} with ${pct(c.ratio ?? 0)} of available points${c.sector ? `, one of at most two from ${c.sector}` : ""}.`,
    })),
    summary: "Demo picks: the best scores on your watchlist, at most two per sector. Not chosen by Claude.",
    source: "demo",
    model: null,
  };
}

function roleFor(ratio: number | null): Role {
  if (ratio === null) return "Satellite";
  if (ratio >= 0.7) return "Core";
  if (ratio >= 0.4) return "Growth";
  return "Satellite";
}

/**
 * Weights by score (a stock at 80% of its points gets twice the weight of one
 * at 40%; unscored stocks count as 40%), with monthly tips built from the DCA
 * rules and the plan's own dollar figures.
 */
export function scoreWeightedPlan(
  candidates: readonly Candidate[],
  { monthly, starting, demo, now = new Date() }: { monthly: number; starting: number; demo: boolean; now?: Date },
): Plan {
  const sorted = [...candidates].sort(byScore);
  const holdings: Holding[] = balanceWeights(
    sorted.map((c) => ({
      symbol: c.symbol,
      weight: Math.max(c.ratio ?? 0.4, 0.1),
      role: roleFor(c.ratio),
      note:
        c.ratio === null
          ? "No score yet, so it gets an average weight."
          : `Graded ${c.grade?.label ?? "n/a"} with ${pct(c.ratio)} of available points.`,
    })),
  );
  const split = allocate({ holdings, monthly, starting });
  const top = split[0];
  const first = holdings[0];
  const regular = split
    .slice(0, 3)
    .map((s) => `${formatDollars(s.monthly)} into ${s.symbol}`)
    .join(", ");

  return {
    name: demo ? "Demo Portfolio" : "Score-Weighted Portfolio",
    monthly,
    starting,
    holdings,
    summary: `${holdings.length} stocks weighted by their stocks-rank score, so the strongest scorecards get the most money${
      first ? `, led by ${first.symbol} at ${first.weight}%` : ""
    }. The weights know nothing about valuation or how the stocks move together, so check the sector mix.${
      demo ? " Demo data: not a proposal from Claude." : ""
    }`,
    startingPlan:
      starting > 0
        ? `Invest ${formatDollars(starting)} by the target weights${top ? ` (${formatDollars(top.starting)} into ${top.symbol} first)` : ""}, or spread it over three months, about ${formatDollars(
            Math.round((starting / 3) * 100) / 100,
          )} a month, if you'd rather not buy everything at today's prices. Holdings in the double-down zone go first.`
        : "",
    tips: [
      `Each month, split ${formatDollars(monthly)} by the target weights${regular ? `: ${regular}, and so on` : ""}.`,
      "When a holding closes 20% or more under its 52-week high, double its buy. Keep the month's total fixed by scaling the other buys down; the This month table does the sums.",
      "After a holding rises 20% or more in a month, halve its buy and spread the difference across the others.",
      "Once a position is up 50% on your average price, trim 10% of it; at 100%, trim 20%. Put the proceeds into the holding furthest below its target weight.",
      "Twice a year, compare actual weights with the targets and steer new money to the ones below target rather than selling.",
    ],
    source: demo ? "demo" : "score",
    model: null,
    createdAt: now.toISOString(),
  };
}
