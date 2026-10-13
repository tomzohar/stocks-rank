import type { QualitativeMetricId, Score } from "@/features/scoring/metrics";

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
  /** Before the browser has read its stored key and cache. */
  | { status: "checking" }
  | { status: "needs-key" }
  | { status: "pending" }
  | {
      status: "ready";
      analysis: QualitativeAnalysis;
      /** Set when the scores come from this browser's cache. */
      cache?: { savedAt: number; expiresAt: number };
    }
  | { status: "error"; message: string; keyRejected: boolean };

/** The company facts the analysis is keyed on — stable, so the cache stays warm. */
export interface AnalysisSubject {
  symbol: string;
  name: string;
  sector: string | null;
  indexes: string[];
}
