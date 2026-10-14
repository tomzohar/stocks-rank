"use client";

import { useMemo, useState } from "react";
import { AnalysisStatus } from "@/features/analysis/components/AnalysisStatus";
import { ClaudeTake } from "@/features/analysis/components/ClaudeTake";
import { analysisSubject } from "@/features/analysis/subject";
import { useClaudeAnalysis } from "@/features/analysis/useClaudeAnalysis";
import type { StockFundamentals } from "@/features/market-data/fundamentals";
import { RadarChart, type RadarAxis } from "@/features/radar/RadarChart";
import { MAX_METRIC_SCORE, type QuantitativeMetricId, type Score } from "@/features/scoring/metrics";
import type { Stock } from "@/features/universe/universe";
import { Panel } from "@/ui/Panel";
import { buildScorecard } from "../model";
import { Insights } from "./Insights";
import { MetricGroup } from "./MetricGroup";
import { ScoreSummary } from "./ScoreSummary";
import styles from "./Scorecard.module.css";

/**
 * The stock's report: market-data scores from the server, plus Claude's
 * judgement-call scores fetched in the browser with the viewer's own key.
 */
export function Scorecard({
  stock,
  fundamentals,
  scores: quantitative,
}: {
  stock: Stock;
  fundamentals: StockFundamentals;
  scores: Record<QuantitativeMetricId, Score | null>;
}) {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const subject = useMemo(() => analysisSubject(stock), [stock]);
  const claude = useClaudeAnalysis(subject, fundamentals.source === "demo" ? fundamentals.asOf : null);
  const analysis = claude.state;

  const model = useMemo(
    () => buildScorecard({ fundamentals, quantitative, analysis }),
    [fundamentals, quantitative, analysis],
  );
  const claudeState = model.qualitative.rows[0]?.state ?? "scored";

  const axes: RadarAxis[] = model.rows.map((r) => ({
    id: r.metric.id,
    label: r.metric.axisLabel,
    title: r.metric.label,
    group: r.metric.kind,
    score: r.score,
    tone: r.tone,
    pending: r.state === "pending",
    value: r.figure?.main ?? null,
    note: r.verdict ?? (r.state === "unscored" ? "Needs your Claude API key" : r.state === "no-data" ? "No data" : null),
  }));

  return (
    <div className={styles.scorecard}>
      <AnalysisStatus analysis={analysis} symbol={subject.symbol} onRetry={claude.retry} />

      <div className={styles.overview}>
        <Panel eyebrow="Score shape" title="13 metrics at a glance" className={styles.radar}>
          <RadarChart
            axes={axes}
            max={MAX_METRIC_SCORE}
            highlighted={highlighted}
            onHighlight={setHighlighted}
            scanning={analysis.status === "pending"}
          />
        </Panel>
        <div className={styles.summary}>
          <ScoreSummary model={model} claudeState={claudeState} />
        </div>
        <div className={styles.insights}>
          <Insights model={model} claudeState={claudeState} />
        </div>
      </div>

      <div className={styles.groups}>
        <MetricGroup
          group={model.quantitative}
          eyebrow="Metrics 1–7 · from market data"
          title="The numbers"
          highlighted={highlighted}
          onHighlight={setHighlighted}
          footer={
            <p className={styles.footnote}>
              Growth and scalability compare the last two fiscal years. The 5-year comparison uses dividend-adjusted
              prices against SPY. Meters mark the scoring cut-offs.
            </p>
          }
        />
        <MetricGroup
          group={model.qualitative}
          eyebrow="Metrics 8–13 · scored by Claude"
          title="The judgement calls"
          status={claudeState === "pending" ? "Scoring…" : claudeState === "unscored" ? "Not scored" : null}
          highlighted={highlighted}
          onHighlight={setHighlighted}
          footer={<ClaudeTake analysis={analysis} symbol={subject.symbol} apiKey={claude.apiKey} onRefresh={claude.refresh} />}
        />
      </div>
    </div>
  );
}
