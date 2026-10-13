"use client";

import type { ReactNode } from "react";
import { SCORE_VALUES } from "@/features/scoring/metrics";
import { cx } from "@/ui/cx";
import { Meter } from "@/ui/Meter";
import { Panel } from "@/ui/Panel";
import { ScorePill } from "@/ui/ScorePill";
import { Skeleton } from "@/ui/Skeleton";
import type { GroupSummary, MetricRow } from "../model";
import styles from "./MetricGroup.module.css";

/** One group of metrics (market data or Claude's), with its subtotal. */
export function MetricGroup({
  group,
  eyebrow,
  title,
  status,
  highlighted,
  onHighlight,
  footer,
}: {
  group: GroupSummary;
  eyebrow: string;
  title: string;
  /** Replaces the subtotal while the group can't be scored. */
  status?: string | null;
  highlighted: string | null;
  onHighlight: (id: string | null) => void;
  footer?: ReactNode;
}) {
  return (
    <Panel
      eyebrow={eyebrow}
      title={title}
      actions={
        <span className={styles.subtotal}>
          {status ?? (
            <>
              <b>{group.points}</b> / {group.max}
            </>
          )}
        </span>
      }
    >
      <ol className={styles.rows}>
        {group.rows.map((row, i) => (
          <Row
            key={row.metric.id}
            row={row}
            index={i}
            highlighted={highlighted === row.metric.id}
            onHighlight={onHighlight}
          />
        ))}
      </ol>
      {footer}
    </Panel>
  );
}

function Row({
  row,
  index,
  highlighted,
  onHighlight,
}: {
  row: MetricRow;
  index: number;
  highlighted: boolean;
  onHighlight: (id: string | null) => void;
}) {
  const { metric } = row;
  const rubric = SCORE_VALUES.filter((s) => metric.criteria[s] !== "—")
    .map((s) => `${s}: ${metric.criteria[s]}`)
    .join(" · ");
  return (
    <li
      className={cx(styles.row, highlighted && styles.hi, styles[row.tone])}
      style={{ "--i": index } as React.CSSProperties}
      onMouseEnter={() => onHighlight(metric.id)}
      onMouseLeave={() => onHighlight(null)}
    >
      <span className={styles.num} aria-hidden="true">
        {String(row.number).padStart(2, "0")}
      </span>
      <div className={styles.body}>
        <div className={styles.head}>
          <h3 className={styles.name}>{metric.label}</h3>
          <ScorePill score={row.score} tone={row.tone} pending={row.state === "pending"} />
        </div>
        <p className={styles.verdict} title={rubric}>
          {row.state === "scored" && row.verdict}
          {row.state === "no-data" && "No data from Yahoo Finance, so it isn't counted"}
          {row.state === "pending" && "Claude is scoring this…"}
          {row.state === "unscored" && "Waiting for Claude"}
        </p>
        <span className="visually-hidden">Rubric: {rubric}</span>

        {row.figure && (
          <div className={styles.data}>
            <div className={styles.figure}>
              <span className={styles.main}>{row.figure.main}</span>
              {row.figure.sub && <span className={styles.sub}>{row.figure.sub}</span>}
            </div>
            {row.meter && <Meter spec={row.meter} />}
          </div>
        )}
        {metric.kind === "qualitative" &&
          (row.state === "pending" ? (
            <div className={styles.skeleton}>
              <Skeleton style={{ width: "92%" }} label="Claude is analyzing" />
              <Skeleton style={{ width: "64%" }} />
            </div>
          ) : (
            row.rationale && <p className={styles.rationale}>{row.rationale}</p>
          ))}
      </div>
    </li>
  );
}
