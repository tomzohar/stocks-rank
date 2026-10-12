// Offline stand-in for the Claude analysis (STOCKS_RANK_DATA=demo).
import { QUALITATIVE_METRIC_IDS, SCORE_VALUES } from "../scoring/metrics";
import type { AnalysisSubject, QualitativeAnalysis } from "./types";

export function demoAnalysis(subject: AnalysisSubject, now = new Date()): QualitativeAnalysis {
  let h = 0;
  for (const ch of subject.symbol) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const metrics = Object.fromEntries(
    QUALITATIVE_METRIC_IDS.map((id, i) => [
      id,
      {
        score: SCORE_VALUES[(h >>> (i * 3)) % 3],
        rationale: "Demo rationale. With an API key, Claude writes the evidence for this score here.",
      },
    ]),
  ) as QualitativeAnalysis["metrics"];
  return {
    metrics,
    summary: `Demo analysis for ${subject.name}. These scores are generated offline and mean nothing.`,
    sources: [],
    model: "demo",
    analyzedAt: now.toISOString(),
    source: "demo",
  };
}
