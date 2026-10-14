"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWatchlist } from "@/features/watchlist/store";
import { cx } from "@/ui/cx";
import { Icon, type IconName } from "@/ui/Icon";
import styles from "./TabBar.module.css";

interface Tab {
  href: string;
  label: string;
  icon: IconName;
  activeIcon?: IconName;
  matches: (pathname: string) => boolean;
}

const TABS: Tab[] = [
  { href: "/", label: "Stocks", icon: "chart", matches: (p) => p === "/" || p.startsWith("/stock/") },
  { href: "/watchlist", label: "Watchlist", icon: "star", activeIcon: "starFill", matches: (p) => p.startsWith("/watchlist") },
  { href: "/portfolios", label: "Portfolios", icon: "pie", activeIcon: "pieFill", matches: (p) => p.startsWith("/portfolios") },
];

/** The phone tab bar. Wrap in Suspense: the pathname isn't known while prerendering a stock page. */
export function TabBar() {
  return <TabBarView pathname={usePathname()} />;
}

/** Without a pathname nothing is highlighted: the prerendered fallback. */
export function TabBarView({ pathname }: { pathname: string | null }) {
  const count = useWatchlist()?.length ?? 0;
  return (
    <nav className={styles.bar} aria-label="Main">
      {TABS.map((tab) => {
        const active = pathname !== null && tab.matches(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cx(styles.tab, active && styles.active)}
            aria-current={active ? "page" : undefined}
            onClick={(e) => {
              // Like iOS: tapping the tab you're on scrolls back to the top.
              if (pathname === tab.href) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            <span className={styles.icon}>
              <Icon name={active && tab.activeIcon ? tab.activeIcon : tab.icon} size={24} />
              {tab.href === "/watchlist" && count > 0 && (
                <span className={styles.badge} aria-hidden="true">
                  {count}
                </span>
              )}
            </span>
            {tab.label}
            {tab.href === "/watchlist" && count > 0 && <span className="visually-hidden">, {count} stocks</span>}
          </Link>
        );
      })}
    </nav>
  );
}
