// What a watchlist row shows for one stock: price, total, grade and the score
// shape, from the last market data fetched for it plus any Claude scores
// cached in this browser. Pure.
import { z } from "zod";
import type { QualitativeAnalysis } from "@/features/analysis/types";
import type { StockFundamentals } from "@/features/market-data/fundamentals";
import { gradeFor, type Grade } from "@/features/scorecard/model";
import {
  METRICS,
  QUANTITATIVE_METRIC_IDS,
  type QualitativeMetricId,
  type QuantitativeMetricId,
  type Score,
} from "@/features/scoring/metrics";
import { totalScore, type Scores, type Total } from "@/features/scoring/score";

/** /api/stock's answer for one stock, as saved on this device. */
export interface QuoteSnapshot {
  fetchedAt: number;
  fundamentals: StockFundamentals;
  scores: Record<QuantitativeMetricId, Score | null>;
}

/** Market data this recent isn't fetched again when the list opens. */
export const QUOTE_FRESH_MS = 15 * 60 * 1000;

const score = z.union([z.literal(0), z.literal(5), z.literal(10), z.null()]);
const snapshot = z.object({
  fetchedAt: z.number(),
  // Only the fields the row reads are checked; the rest passes through.
  fundamentals: z.looseObject({
    symbol: z.string(),
    price: z.number().nullable(),
    currency: z.string().nullable(),
    asOf: z.string(),
    source: z.enum(["yahoo", "demo"]),
  }),
  scores: z.object(Object.fromEntries(QUANTITATIVE_METRIC_IDS.map((id) => [id, score]))),
});

/** A saved snapshot, or null if missing or malformed. */
export function parseQuote(raw: string | null): QuoteSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = snapshot.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as unknown as QuoteSnapshot) : null;
  } catch {
    return null;
  }
}

export const isFresh = (q: QuoteSnapshot | null, nowMs: number) => q !== null && nowMs - q.fetchedAt < QUOTE_FRESH_MS;

export interface StockSummary {
  price: number | null;
  currency: string | null;
  /** When the market data was fetched (ISO). */
  asOf: string;
  total: Total;
  grade: Grade | null;
  /** Whether Claude's six scores are included. */
  claudeScored: boolean;
  /** All 13 scores in metric order, unscored as 0, for the mini radar. */
  shape: number[];
  demo: boolean;
}

export function summarizeStock(quote: QuoteSnapshot, analysis: QualitativeAnalysis | null): StockSummary {
  const scores: Scores = Object.fromEntries(
    METRICS.map((m) => [
      m.id,
      m.kind === "quantitative"
        ? (quote.scores[m.id as QuantitativeMetricId] ?? null)
        : (analysis?.metrics[m.id as QualitativeMetricId]?.score ?? null),
    ]),
  );
  const total = totalScore(scores);
  return {
    price: quote.fundamentals.price,
    currency: quote.fundamentals.currency,
    asOf: quote.fundamentals.asOf,
    total,
    grade: gradeFor(total.ratio),
    claudeScored: analysis !== null,
    shape: METRICS.map((m) => scores[m.id] ?? 0),
    demo: quote.fundamentals.source === "demo",
  };
}
