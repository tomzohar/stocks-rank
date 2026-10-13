import { Icon } from "@/ui/Icon";
import { Panel } from "@/ui/Panel";
import type { Callout, RowState, ScorecardModel } from "../model";
import styles from "./Insights.module.css";

/** The metrics that scored 10 and 0, each as a one-line takeaway. */
export function Insights({ model, claudeState }: { model: ScorecardModel; claudeState: RowState }) {
  const waiting = claudeState === "pending" || claudeState === "unscored";
  return (
    <Panel eyebrow="Callouts" title="What stands out">
      <div className={styles.columns}>
        <List tone="good" title="Strengths" empty="Nothing scored a 10." items={model.strengths} />
        <List tone="critical" title="Watch-outs" empty="Nothing scored a 0." items={model.watchOuts} />
      </div>
      {waiting && (
        <p className={styles.note}>
          {claudeState === "pending"
            ? "Claude's six judgement calls will join these when it finishes."
            : "Claude's six judgement calls appear here once it has scored them."}
        </p>
      )}
    </Panel>
  );
}

function List({ tone, title, empty, items }: { tone: "good" | "critical"; title: string; empty: string; items: Callout[] }) {
  return (
    <section className={`${styles.list} ${styles[tone]}`} aria-label={title}>
      <h3>
        <span className={styles.badge}>
          <Icon name={tone === "good" ? "arrowUp" : "arrowDown"} size={13} />
        </span>
        {title}
        <span className={styles.count}>{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul>
          {items.map((c) => (
            <li key={c.metric.id}>
              <span className={styles.metric}>{c.metric.axisLabel}</span>
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
