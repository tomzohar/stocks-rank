import type { Tone } from "./tone";
import styles from "./TierBar.module.css";

export interface TierSegment {
  label: string;
  count: number;
  tone: Tone;
}

/** A stacked bar of how many items landed in each tier, with a text legend. */
export function TierBar({ segments, label }: { segments: readonly TierSegment[]; label: string }) {
  const total = segments.reduce((n, s) => n + s.count, 0);
  return (
    <figure className={styles.tiers}>
      <div className={styles.bar} role="img" aria-label={`${label}: ${segments.map((s) => `${s.count} ${s.label}`).join(", ")}`}>
        {segments.map((s, i) =>
          s.count === 0 ? null : (
            <span
              key={s.label}
              className={styles[s.tone]}
              style={{ flexGrow: s.count, animationDelay: `${i * 90}ms` }}
              title={`${s.count} ${s.label}`}
            />
          ),
        )}
        {total === 0 && <span className={styles.empty} style={{ flexGrow: 1 }} />}
      </div>
      <figcaption className={styles.legend}>
        {segments.map((s) => (
          <span key={s.label}>
            <i className={styles[s.tone]} aria-hidden="true" />
            <b>{s.count}</b> {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
