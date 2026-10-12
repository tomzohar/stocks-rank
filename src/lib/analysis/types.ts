import type { QualitativeMetricId, Score } from "../scoring/metrics";

export interface MetricAssessment {
  score: Score;
  /** One or two sentences naming the evidence behind the score. */
  rationale: string;
}

/** Claude's scores for the judgement-call metrics (8–13). */
export interface QualitativeAnalysis {
  metrics: Record<QualitativeMetricId, MetricAssessment>;
  summary: string;
  /** Pages Claude relied on — only ones its web searches actually returned. */
  sources: { title: string; url: string }[];
  /** Model that produced the answer (differs from the requested one after a fallback). */
  model: string;
  analyzedAt: string;
  source: "claude" | "demo";
}

/** What the UI renders for metrics 8–13. */
export type AnalysisState =
  | { status: "pending" }
  | { status: "ready"; analysis: QualitativeAnalysis }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string };

/** The company facts the analysis is keyed on — stable, so the cache stays warm. */
export interface AnalysisSubject {
  symbol: string;
  name: string;
  sector: string | null;
  indexes: string[];
}
