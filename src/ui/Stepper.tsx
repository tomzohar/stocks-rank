"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import styles from "./Stepper.module.css";

/**
 * An iOS stepper: a label, the current value, and − / + buttons. Arrow keys
 * work on either button, and the value is announced as it changes.
 */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  format = String,
  detail,
  className,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** How the value reads, e.g. 0 → "Any". */
  format?: (value: number) => string;
  detail?: ReactNode;
  className?: string;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  const name = typeof label === "string" ? label : "value";
  return (
    <div
      className={cx(styles.row, className)}
      onKeyDown={(e) => {
        const step = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        set(value + step);
      }}
    >
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
      </span>
      <output className={styles.value} aria-live="polite">
        {format(value)}
      </output>
      <span className={styles.buttons}>
        <button type="button" aria-label={`Fewer: ${name}`} disabled={value <= min} onClick={() => set(value - 1)}>
          <Icon name="minus" size={16} />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button type="button" aria-label={`More: ${name}`} disabled={value >= max} onClick={() => set(value + 1)}>
          <Icon name="plus" size={16} />
        </button>
      </span>
    </div>
  );
}
