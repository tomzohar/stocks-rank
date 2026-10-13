"use client";

import Link from "next/link";
import { useWatchlist } from "@/features/watchlist/store";
import { Icon } from "@/ui/Icon";
import styles from "./HeaderNav.module.css";

/** The watchlist link in the header, on wider screens (phones use the tab bar). */
export function HeaderNav() {
  const count = useWatchlist()?.length ?? 0;
  return (
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
  );
}
