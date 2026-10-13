import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import type { Tone } from "./tone";
import styles from "./Callout.module.css";

const DEFAULT_ICON: Record<Tone | "accent", IconName> = {
  good: "check",
  warning: "alert",
  critical: "alert",
  neutral: "info",
  accent: "sparkle",
};

/** A highlighted note: an icon, a title, and supporting content or actions. */
export function Callout({
  tone = "neutral",
  icon,
  title,
  children,
  actions,
  busy,
  className,
  role,
  "aria-label": ariaLabel,
}: {
  tone?: Tone | "accent";
  icon?: IconName | null;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Replaces the icon with a spinner. */
  busy?: boolean;
  className?: string;
  role?: string;
  "aria-label"?: string;
}) {
  const iconName = icon === undefined ? DEFAULT_ICON[tone] : icon;
  return (
    <div className={cx(styles.callout, styles[tone], className)} role={role} aria-label={ariaLabel}>
      {busy ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        iconName && (
          <span className={styles.icon}>
            <Icon name={iconName} size={15} />
          </span>
        )
      )}
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.content}>{children}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
