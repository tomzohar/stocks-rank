"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { findStock, POPULAR } from "@/features/universe/universe";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { Menu } from "@/ui/Menu";
import { ActionSheet } from "@/ui/Sheet";
import { Skeleton } from "@/ui/Skeleton";
import { TierBar } from "@/ui/TierBar";
import { Toast } from "@/ui/Toast";
import { useDragReorder } from "@/ui/useDragReorder";
import {
  addToWatchlist,
  clearWatchlist,
  moveInWatchlist,
  refreshQuotes,
  removeFromWatchlist,
  undoRemove,
  useWatchlist,
  useWatchlistRows,
  useWatchlistSort,
  type Removed,
} from "../store";
import { sortEntries, WATCHLIST_SORTS, type WatchlistEntry } from "../watchlist";
import { AddStocksSheet } from "./AddStocksSheet";
import { WatchlistRow } from "./WatchlistRow";
import styles from "./WatchlistView.module.css";

/** Keys each toast so a new one restarts its timer. */
let toastSeq = 0;

/** The watchlist screen: an iOS-style large title, toolbar, overview and list. */
export function WatchlistView() {
  const entries = useWatchlist();
  const [adding, setAdding] = useState(false);
  return (
    <div className={styles.view}>
      {entries === null ? (
        <Loading />
      ) : entries.length === 0 ? (
        <Empty onAdd={() => setAdding(true)} />
      ) : (
        <List entries={entries} onAdd={() => setAdding(true)} />
      )}
      {entries && <AddStocksSheet open={adding} onClose={() => setAdding(false)} entries={entries} />}
    </div>
  );
}

function List({ entries, onAdd }: { entries: WatchlistEntry[]; onAdd: () => void }) {
  const router = useRouter();
  const buildPortfolio = () => router.push("/portfolios/new");
  const [sort, setSort] = useWatchlistSort();
  const [editing, setEditing] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [undo, setUndo] = useState<{ id: number; removed: Removed } | null>(null);

  const symbols = useMemo(() => entries.map((e) => e.symbol), [entries]);
  const rows = useWatchlistRows(symbols);
  const key = symbols.join(",");

  // Fetch what's missing or stale when the list opens or changes, and again
  // when the app comes back to the foreground or online.
  useEffect(() => {
    const list = key.split(",");
    void refreshQuotes(list);
    const again = () => document.visibilityState === "visible" && void refreshQuotes(list);
    document.addEventListener("visibilitychange", again);
    window.addEventListener("online", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("online", again);
    };
  }, [key]);

  // Editing works on the saved order, which is what reordering changes.
  const ordered = editing ? entries : sortEntries(entries, sort, (s) => rows.get(s)?.summary?.total.ratio ?? null);
  const reorder = useDragReorder(entries.length, moveInWatchlist);

  const remove = (symbol: string) => {
    setOpenRow(null);
    const removed = removeFromWatchlist(symbol);
    if (removed) setUndo({ id: ++toastSeq, removed });
  };

  const summaries = entries.map((e) => rows.get(e.symbol)?.summary ?? null);
  const graded = (label: string) => summaries.filter((s) => s?.grade?.label === label).length;
  const withClaude = summaries.filter((s) => s?.claudeScored).length;
  const sortLabel = WATCHLIST_SORTS.find((s) => s.id === sort)?.label ?? "My Order";

  return (
    <>
      {/* Overlays stay outside .reveal, whose entrance animation would override theirs. */}
      <div className={`${styles.stack} reveal`}>
        <header className={styles.nav}>
          <div className={styles.titleRow}>
            <h1>Watchlist</h1>
            <div className={styles.toolbar}>
              <Button
                variant={editing ? "primary" : "ghost"}
                size="sm"
                onClick={() => {
                  setEditing((e) => !e);
                  setOpenRow(null);
                }}
              >
                {editing ? "Done" : "Edit"}
              </Button>
              <Button variant="tinted" size="sm" icon="plus" iconOnly aria-label="Add stocks" onClick={onAdd} />
              <Menu
                label="Watchlist options"
                icon="more"
                variant="tinted"
                size="sm"
                sections={[
                  {
                    title: "Sort By",
                    items: WATCHLIST_SORTS.map((s) => ({
                      id: s.id,
                      label: s.label,
                      checked: sort === s.id,
                      onSelect: () => setSort(s.id),
                    })),
                  },
                  {
                    items: [
                      {
                        id: "edit",
                        label: editing ? "Done Editing" : "Edit List",
                        icon: "pencil",
                        onSelect: () => setEditing((e) => !e),
                      },
                      {
                        id: "refresh",
                        label: "Refresh Data",
                        icon: "refresh",
                        onSelect: () => void refreshQuotes(symbols, { force: true }),
                      },
                      { id: "portfolio", label: "Build Portfolio", icon: "pie", onSelect: buildPortfolio },
                    ],
                  },
                  {
                    items: [
                      {
                        id: "clear",
                        label: "Clear Watchlist",
                        icon: "trash",
                        destructive: true,
                        onSelect: () => setConfirmClear(true),
                      },
                    ],
                  },
                ]}
              />
            </div>
          </div>
          <p className={styles.subtitle}>
            {entries.length} {entries.length === 1 ? "stock" : "stocks"} ·{" "}
            {editing ? "Drag to reorder, or tap ⊖ to delete" : `Sorted by ${sortLabel}`}
          </p>
        </header>

        <section className={styles.overview} aria-label="Overview" style={{ "--i": 1 } as React.CSSProperties}>
          <TierBar
            label="Grades"
            segments={[
              { label: "Strong", count: graded("Strong"), tone: "good" },
              { label: "Mixed", count: graded("Mixed"), tone: "warning" },
              { label: "Weak", count: graded("Weak"), tone: "critical" },
              { label: "Loading", count: summaries.filter((s) => !s).length, tone: "neutral" },
            ]}
          />
          <p className={styles.note}>
            <Icon name="info" size={14} />
            {withClaude === entries.length
              ? "Every grade includes Claude's six judgement scores."
              : `${withClaude} of ${entries.length} include Claude's judgement scores; the rest are graded on market data. Open a stock to score it.`}
          </p>
          <div className={styles.build}>
            <span>
              <strong>Build a portfolio</strong>
              Pick stocks from this list, set a monthly amount, and let Claude propose the split.
            </span>
            <Button variant="tinted" size="sm" icon="pie" onClick={buildPortfolio}>
              Build
            </Button>
          </div>
        </section>

        <ul className={styles.list} style={{ "--i": 2 } as React.CSSProperties}>
          {ordered.map((entry, i) => (
            <li
              key={entry.symbol}
              ref={reorder.rowRef(i)}
              style={editing ? reorder.rowStyle(i) : undefined}
              className={editing && reorder.dragging === i ? styles.lifted : undefined}
            >
              <WatchlistRow
                symbol={entry.symbol}
                name={findStock(entry.symbol)?.name ?? null}
                data={rows.get(entry.symbol)}
                editing={editing}
                open={openRow === entry.symbol}
                onOpenChange={(o) => setOpenRow(o ? entry.symbol : null)}
                onRemove={() => remove(entry.symbol)}
                handle={editing ? reorder.handleProps(i) : undefined}
              />
            </li>
          ))}
        </ul>
        <p className={styles.footnote}>
          Saved on this device. Grades use the share of points earned on the metrics that have a score; prices are
          delayed.
        </p>
      </div>

      <ActionSheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear your watchlist?"
        message={`All ${entries.length} stocks will be removed from this device.`}
        actions={[
          {
            label: "Clear Watchlist",
            destructive: true,
            onSelect: () => {
              setEditing(false);
              clearWatchlist();
            },
          },
        ]}
      />
      {undo && (
        <Toast
          key={undo.id}
          icon="trash"
          action={{ label: "Undo", onClick: () => undoRemove(undo.removed) }}
          onDismiss={() => setUndo(null)}
        >
          Removed {undo.removed.entry.symbol}
        </Toast>
      )}
    </>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className={`${styles.empty} reveal`}>
      <span className={styles.emptyIcon}>
        <Icon name="star" size={34} />
      </span>
      <h1>No stocks yet</h1>
      <p>Keep the stocks you follow in one place and compare their scores at a glance.</p>
      <Button variant="primary" icon="plus" onClick={onAdd}>
        Add Stocks
      </Button>
      <div className={styles.suggest}>
        <span>Or start with</span>
        {POPULAR.slice(0, 4).map((s) => (
          <Button key={s.symbol} variant="secondary" size="sm" onClick={() => addToWatchlist(s.symbol)}>
            {s.symbol}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading your watchlist">
      <Skeleton style={{ width: "10rem", height: "2.2rem", marginBottom: "1.25rem" }} />
      <Skeleton style={{ height: "16rem", borderRadius: "14px" }} />
    </div>
  );
}
