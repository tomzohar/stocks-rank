// The stocks a portfolio can be built from (the watchlist), with what the
// selection rules and Claude read about each, and the rules themselves. Pure.
import type { Grade } from "@/features/scorecard/model";
import type { Scores } from "@/features/scoring/score";
import type { Stock } from "@/features/universe/universe";
import type { StockSummary } from "@/features/watchlist/summary";

export interface Candidate {
  symbol: string;
  name: string;
  sector: string | null;
  price: number | null;
  /** Share of available points, or null with no scores yet. */
  ratio: number | null;
  grade: Grade | null;
  claudeScored: boolean;
  scores: Scores | null;
  demo: boolean;
  /** Market data is on its way. */
  loading?: boolean;
}

/** A watchlist stock as a candidate; scores stay null until its market data has loaded. */
export function toCandidate(symbol: string, stock: Stock | undefined, summary: StockSummary | null, loading = false): Candidate {
  return {
    symbol,
    name: stock?.name ?? symbol,
    sector: stock?.sector ?? null,
    price: summary?.price ?? null,
    ratio: summary?.total.ratio ?? null,
    grade: summary?.grade ?? null,
    claudeScored: summary?.claudeScored ?? false,
    scores: summary?.scores ?? null,
    demo: summary?.demo ?? false,
    loading: !summary && loading,
  };
}

/** Best score first, unscored last, then by symbol. */
export function byScore(a: Candidate, b: Candidate): number {
  if (a.ratio === null || b.ratio === null) {
    if (a.ratio !== b.ratio) return a.ratio === null ? 1 : -1;
  } else if (a.ratio !== b.ratio) return b.ratio - a.ratio;
  return a.symbol.localeCompare(b.symbol);
}

// ---- selection rules ----

export type MinGrade = "any" | "Mixed" | "Strong";

export interface SelectionRules {
  minGrade: MinGrade;
  /** Metric 1 scores 5 or 10: more cash than debt. */
  cashOverDebt: boolean;
  /** Metric 2 scores 5 or 10: revenue up 10% or more. */
  growing: boolean;
  /** Metric 7 scores 5 or 10: 10+ points ahead of the S&P 500 over 5 years. */
  beatsMarket: boolean;
  /** Only stocks Claude has scored in this browser. */
  claudeOnly: boolean;
  /** At most this many from one sector; null for no cap. */
  maxPerSector: number | null;
  /** At most this many stocks, best scores first. */
  limit: number;
}

export const DEFAULT_RULES: SelectionRules = {
  minGrade: "Mixed",
  cashOverDebt: false,
  growing: false,
  beatsMarket: false,
  claudeOnly: false,
  maxPerSector: 3,
  limit: 10,
};

const GRADE_FLOOR: Record<MinGrade, number> = { any: 0, Mixed: 0.4, Strong: 0.7 };

export interface Exclusion {
  symbol: string;
  reason: string;
}

/**
 * Applies the rules to the candidates: filters first, then takes the best
 * scores, skipping a stock whose sector is already full, up to the limit.
 * Every stock left out says why.
 */
export function selectByRules(candidates: readonly Candidate[], rules: SelectionRules): { picked: Candidate[]; excluded: Exclusion[] } {
  const excluded: Exclusion[] = [];
  const eligible: Candidate[] = [];
  const atLeastFive = (c: Candidate, id: keyof Scores) => (c.scores?.[id] ?? 0) >= 5;

  for (const c of [...candidates].sort(byScore)) {
    const why =
      c.ratio === null || !c.scores
        ? "No market data yet"
        : c.ratio < GRADE_FLOOR[rules.minGrade]
          ? `Graded ${c.grade?.label ?? "lower"}, below ${rules.minGrade}`
          : rules.claudeOnly && !c.claudeScored
            ? "Claude hasn't scored it yet"
            : rules.cashOverDebt && !atLeastFive(c, "cashVsDebt")
              ? "Debt is at least as large as cash"
              : rules.growing && !atLeastFive(c, "revenueGrowth")
                ? "Revenue growth under 10%, or unknown"
                : rules.beatsMarket && !atLeastFive(c, "fiveYearVsSp500")
                  ? "Not 10+ points ahead of the S&P 500 over 5 years"
                  : null;
    if (why) excluded.push({ symbol: c.symbol, reason: why });
    else eligible.push(c);
  }

  const picked: Candidate[] = [];
  const perSector = new Map<string, number>();
  for (const c of eligible) {
    const sector = c.sector ?? "Unknown sector";
    const n = perSector.get(sector) ?? 0;
    if (picked.length >= rules.limit) excluded.push({ symbol: c.symbol, reason: `Past the limit of ${rules.limit}` });
    else if (rules.maxPerSector !== null && n >= rules.maxPerSector)
      excluded.push({ symbol: c.symbol, reason: `Already ${n} from ${sector}` });
    else {
      picked.push(c);
      perSector.set(sector, n + 1);
    }
  }
  return { picked, excluded };
}
