"use client";

import { useMemo, useState } from "react";
import { POPULAR, searchStocks } from "@/features/universe/universe";
import { cx } from "@/ui/cx";
import { Icon } from "@/ui/Icon";
import { Sheet } from "@/ui/Sheet";
import { addToWatchlist, removeFromWatchlist } from "../store";
import { MAX_WATCHLIST, type WatchlistEntry } from "../watchlist";
import styles from "./AddStocksSheet.module.css";

/** Search the universe and tick stocks on or off the watchlist. */
export function AddStocksSheet({
  open,
  onClose,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  entries: readonly WatchlistEntry[];
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => (query.trim() ? searchStocks(query, { limit: 50 }) : POPULAR), [query]);
  const watched = new Set(entries.map((e) => e.symbol));
  const full = entries.length >= MAX_WATCHLIST;

  return (
    <Sheet
      open={open}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      title="Add Stocks"
    >
      <label className={styles.search}>
        <Icon name="search" size={16} />
        <span className="visually-hidden">Search stocks</span>
        <input
          type="search"
          placeholder="Symbol or company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
      </label>
      <p className={styles.section}>{query.trim() ? `${results.length === 50 ? "Top 50" : results.length} results` : "Popular"}</p>
      {results.length === 0 ? (
        <p className={styles.empty}>No S&amp;P 500 or Nasdaq-100 stock matches “{query.trim()}”.</p>
      ) : (
        <ul className={styles.list}>
          {results.map((s) => {
            const on = watched.has(s.symbol);
            return (
              <li key={s.symbol}>
                <button
                  type="button"
                  className={styles.item}
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => (on ? removeFromWatchlist(s.symbol) : addToWatchlist(s.symbol))}
                >
                  <span className={styles.symbol}>{s.symbol}</span>
                  <span className={styles.name}>{s.name}</span>
                  <span className={cx(styles.toggle, on && styles.on)} aria-hidden="true">
                    <Icon name={on ? "check" : "plus"} size={15} />
                  </span>
                  <span className="visually-hidden">{on ? "In your watchlist" : "Add to watchlist"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {full && <p className={styles.empty}>Your watchlist is full ({MAX_WATCHLIST} stocks).</p>}
    </Sheet>
  );
}
