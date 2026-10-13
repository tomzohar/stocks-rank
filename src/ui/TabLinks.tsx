import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import styles from "./TabLinks.module.css";

export interface TabLink {
  href: string;
  label: ReactNode;
  icon?: IconName;
}

/**
 * Page tabs drawn as an iOS segmented control. Each tab is its own URL, so
 * tabs can be shared, bookmarked and reached with Back.
 */
export function TabLinks({
  label,
  tabs,
  active,
  className,
}: {
  label: string;
  tabs: readonly TabLink[];
  /** Index of the current tab. */
  active: number;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cx(styles.tabs, className)} style={{ "--n": tabs.length, "--i": active } as React.CSSProperties}>
      <span className={styles.thumb} aria-hidden="true" />
      {tabs.map((t, i) => (
        <Link key={t.href} href={t.href} className={styles.tab} aria-current={i === active ? "page" : undefined} scroll={false}>
          {t.icon && <Icon name={t.icon} size={15} />}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
