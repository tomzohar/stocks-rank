"use client";

import { MAX_TOTAL_SCORE, METRICS } from "@/features/scoring/metrics";
import { cx } from "@/ui/cx";
import { CountUp } from "@/ui/CountUp";
import { Gauge } from "@/ui/Gauge";
import { Panel } from "@/ui/Panel";
import { TierBar } from "@/ui/TierBar";
import type { GroupSummary, RowState, ScorecardModel } from "../model";
import styles from "./ScoreSummary.module.css";

const GROUP_NAMES: Record<GroupSummary["kind"], string> = { quantitative: "Market data", qualitative: "Claude's judgement" };

/** The headline: total points, grade, each group's share, and the tier mix. */
export function ScoreSummary({ model, claudeState }: { model: ScorecardModel; claudeState: RowState }) {
  const { total, grade, tiers } = model;
  return (
    <Panel eyebrow="Total score" className={styles.summary}>
      <div className={styles.top}>
        <Gauge value={total.points} max={MAX_TOTAL_SCORE} label={`${total.points} of ${MAX_TOTAL_SCORE} points`}>
          <span className={styles.points}>
            <CountUp value={total.points} />
          </span>
          <span className={styles.max}>of {MAX_TOTAL_SCORE}</span>
        </Gauge>
        <div className={styles.side}>
          {grade ? (
            <p className={cx(styles.grade, styles[grade.tone])}>
              <i aria-hidden="true" />
              {grade.label}
            </p>
          ) : (
            <p className={styles.grade}>Not graded</p>
          )}
          <p className={styles.ratio}>
            {total.ratio === null
              ? "No metric has a score yet."
              : `${Math.round(total.ratio * 100)}% of the points available on the ${total.scoredCount} scored metric${total.scoredCount === 1 ? "" : "s"}.`}
          </p>
          <p className={styles.count}>
            <b>{total.scoredCount}</b>/{METRICS.length} scored
          </p>
        </div>
      </div>

      <div className={styles.groups}>
        <GroupBar group={model.quantitative} />
        <GroupBar
          group={model.qualitative}
          status={claudeState === "pending" ? "Scoring…" : claudeState === "unscored" ? "Needs Claude" : null}
        />
      </div>

      <TierBar
        label="Scores by tier"
        segments={[
          { label: "at 10", count: tiers.ten, tone: "good" },
          { label: "at 5", count: tiers.five, tone: "warning" },
          { label: "at 0", count: tiers.zero, tone: "critical" },
          { label: "unscored", count: tiers.none, tone: "neutral" },
        ]}
      />
    </Panel>
  );
}

function GroupBar({ group, status }: { group: GroupSummary; status?: string | null }) {
  const pct = (group.points / group.max) * 100;
  return (
    <div className={styles.group}>
      <div className={styles.groupHead}>
        <span>{GROUP_NAMES[group.kind]}</span>
        <span className={styles.groupValue}>{status ?? `${group.points} / ${group.max}`}</span>
      </div>
      <div className={cx(styles.bar, status && styles.barIdle)} aria-hidden="true">
        {!status && <span style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}
