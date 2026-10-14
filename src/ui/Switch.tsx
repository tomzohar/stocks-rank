"use client";

import { useId, type ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Switch.module.css";

/** An iOS switch with its label on the left and optional detail under it. A `role="switch"` button. */
export function Switch({
  checked,
  onChange,
  label,
  detail,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx(styles.row, className)}>
      <span className={styles.text}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        {detail && (
          <span id={`${id}-detail`} className={styles.detail}>
            {detail}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={detail ? `${id}-detail` : undefined}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} aria-hidden="true" />
      </button>
    </div>
  );
}
