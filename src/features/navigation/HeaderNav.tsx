"use client";

import Link from "next/link";
import { usePortfolios } from "@/features/portfolio/store";
import { useWatchlist } from "@/features/watchlist/store";
import { Icon } from "@/ui/Icon";
import styles from "./HeaderNav.module.css";

/** The watchlist and portfolios links in the header, on wider screens (phones use the tab bar). */
export function HeaderNav() {
  const count = useWatchlist()?.length ?? 0;
  const portfolios = usePortfolios()?.length ?? 0;
  return (
    <nav className={styles.nav} aria-label="Your lists">
      <Link href="/watchlist" className={styles.link}>
        <Icon name={count > 0 ? "starFill" : "star"} size={16} />
        Watchlist
        {count > 0 && (
          <>
            <span className={styles.count} aria-hidden="true">
              {count}
            </span>
            <span className="visually-hidden">, {count} stocks</span>
          </>
        )}
      </Link>
      <Link href="/portfolios" className={styles.link}>
        <Icon name={portfolios > 0 ? "pieFill" : "pie"} size={16} />
        Portfolios
        {portfolios > 0 && (
          <>
            <span className={styles.count} aria-hidden="true">
              {portfolios}
            </span>
            <span className="visually-hidden">, {portfolios} saved</span>
          </>
        )}
      </Link>
    </nav>
  );
}
