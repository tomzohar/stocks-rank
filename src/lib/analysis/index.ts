import "server-only";
import { unstable_cache } from "next/cache";
import { analyzeWithClaude } from "./claude";
import { demoAnalysis } from "./demo";
import { ANALYSIS_VERSION } from "./prompt";
import { INDEX_LABELS, type Stock } from "../universe";
import type { AnalysisState, AnalysisSubject } from "./types";

const WEEK_SECONDS = 7 * 24 * 60 * 60;

// unstable_cache, not "use cache": its entries survive deploys, and each
// analysis is a paid API call. ANALYSIS_VERSION in the key is what
// invalidates them when the prompt changes.
const cachedAnalysis = unstable_cache(
  (subject: AnalysisSubject) => analyzeWithClaude(subject),
  ["claude-analysis", ANALYSIS_VERSION],
  { revalidate: WEEK_SECONDS, tags: ["claude-analysis"] },
);

/** Claude's scores for metrics 8–13. Never throws — failures become a state the UI shows. */
export async function getAnalysis(subject: AnalysisSubject): Promise<AnalysisState> {
  if (process.env.STOCKS_RANK_DATA === "demo") {
    return { status: "ready", analysis: demoAnalysis(subject) };
  }
  // Checked outside the cache so a missing key is never cached.
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "unavailable", reason: "Set ANTHROPIC_API_KEY to have Claude score these metrics." };
  }
  try {
    return { status: "ready", analysis: await cachedAnalysis(subject) };
  } catch (err) {
    console.error(`Claude analysis for ${subject.symbol} failed:`, err);
    return { status: "error", message: "Claude's analysis failed. Reload to try again." };
  }
}

/** The stable company facts an analysis is keyed on. */
export function analysisSubject(stock: Stock): AnalysisSubject {
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    indexes: stock.indexes.map((i) => INDEX_LABELS[i]),
  };
}

export type { AnalysisState, QualitativeAnalysis } from "./types";
