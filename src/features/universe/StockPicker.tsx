"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/ui/Icon";
import styles from "./StockPicker.module.css";
import { INDEX_LABELS, searchStocks, STOCKS, type IndexId } from "./universe";

const FILTERS: { id: IndexId | "ALL"; label: string; count: number }[] = [
  { id: "ALL", label: "All", count: STOCKS.length },
  { id: "SP500", label: INDEX_LABELS.SP500, count: STOCKS.filter((s) => s.indexes.includes("SP500")).length },
  { id: "NDX", label: INDEX_LABELS.NDX, count: STOCKS.filter((s) => s.indexes.includes("NDX")).length },
];

/** Search-as-you-type combobox over the S&P 500 ∪ Nasdaq-100. Choosing a stock opens its page. */
export function StockPicker() {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<IndexId | "ALL">("ALL");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(
    () => searchStocks(query, { index: filter === "ALL" ? undefined : filter, limit: 50 }),
    [query, filter],
  );

  function choose(symbol: string) {
    setOpen(false);
    setQuery("");
    router.push(`/stock/${symbol}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      choose(results[active].symbol);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const activeId = open && results[active] ? `${listId}-${results[active].symbol}` : undefined;

  return (
    <div className={styles.picker}>
      <div className={styles.filters} role="group" aria-label="Index">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={styles.chip}
            aria-pressed={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setActive(0);
            }}
          >
            {f.label} <span className={styles.count}>{f.count}</span>
          </button>
        ))}
      </div>
      <div className={styles.box}>
        <Icon name="search" size={16} className={styles.searchIcon} />
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label="Search stocks by symbol or name"
          placeholder="Search a stock — e.g. NVDA or Costco"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {open && (
          <ul id={listId} role="listbox" className={styles.list}>
            {results.length === 0 && <li className={styles.empty}>No match in the selected index</li>}
            {results.map((s, i) => (
              <li
                key={s.symbol}
                id={`${listId}-${s.symbol}`}
                role="option"
                aria-selected={i === active}
                className={styles.option}
                // mousedown, not click: it fires before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s.symbol);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className={styles.symbol}>{s.symbol}</span>
                <span className={styles.name}>{s.name}</span>
                <span className={styles.indexes}>{s.indexes.map((x) => (x === "SP500" ? "S&P" : "NDX")).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
