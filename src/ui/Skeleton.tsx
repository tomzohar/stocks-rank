import type { CSSProperties } from "react";
import { cx } from "./cx";
import styles from "./Skeleton.module.css";

/** A shimmering placeholder block. */
export function Skeleton({ className, style, label }: { className?: string; style?: CSSProperties; label?: string }) {
  return (
    <span
      className={cx(styles.skeleton, className)}
      style={style}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      role={label ? "status" : undefined}
    />
  );
}
