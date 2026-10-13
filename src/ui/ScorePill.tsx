import { cx } from "./cx";
import type { Tone } from "./tone";
import styles from "./ScorePill.module.css";

/**
 * A 0/5/10 score: the number, plus two pips that fill per tier (none for 0,
 * one for 5, both for 10) so the level reads without colour.
 */
export function ScorePill({
  score,
  tone,
  pending,
  label,
}: {
  score: 0 | 5 | 10 | null;
  tone: Tone;
  pending?: boolean;
  /** Accessible text; defaults to "Score N of 10". */
  label?: string;
}) {
  if (pending) {
    return (
      <span className={cx(styles.pill, styles.pending)} aria-label={label ?? "Being scored"}>
        <span className={styles.pips} aria-hidden="true">
          <i />
          <i />
        </span>
        <span className={styles.num}>…</span>
      </span>
    );
  }
  const filled = score === null ? 0 : score / 5;
  return (
    <span
      className={cx(styles.pill, styles[tone])}
      aria-label={label ?? (score === null ? "No score" : `Score ${score} of 10`)}
      title={score === null ? "No data" : undefined}
    >
      <span className={styles.pips} aria-hidden="true">
        <i className={filled >= 1 ? styles.on : undefined} />
        <i className={filled >= 2 ? styles.on : undefined} />
      </span>
      <span className={styles.num} aria-hidden="true">
        {score ?? "n/a"}
      </span>
    </span>
  );
}
