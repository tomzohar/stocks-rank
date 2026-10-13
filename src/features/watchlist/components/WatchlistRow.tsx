"use client";

import Link from "next/link";
import type { HTMLAttributes } from "react";
import { RadarGlyph } from "@/features/radar/RadarGlyph";
import { formatPrice } from "@/lib/format";
import { cx } from "@/ui/cx";
import { Icon } from "@/ui/Icon";
import { LocalTime } from "@/ui/LocalTime";
import { Skeleton } from "@/ui/Skeleton";
import { SwipeActions } from "@/ui/SwipeActions";
import type { RowData } from "../store";
import styles from "./WatchlistRow.module.css";

const FLAT = Array<number>(13).fill(0);

/**
 * One stock: its score shape, name, price and grade. Swipe left to delete;
 * in edit mode, a red minus reveals Delete and the grip reorders.
 */
export function WatchlistRow({
  symbol,
  name,
  data,
  editing,
  open,
  onOpenChange,
  onRemove,
  handle,
}: {
  symbol: string;
  /** Null when the stock has left the S&P 500 and Nasdaq-100. */
  name: string | null;
  data: RowData | undefined;
  editing: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  handle?: HTMLAttributes<HTMLElement>;
}) {
  const summary = data?.summary ?? null;
  const ratio = summary?.total.ratio ?? null;

  return (
    <SwipeActions
      actions={[{ label: "Delete", icon: "trash", destructive: true, onSelect: onRemove }]}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className={cx(styles.row, editing && styles.editing)}>
        {editing && (
          <button
            type="button"
            className={styles.minus}
            aria-label={`Delete ${symbol}`}
            aria-expanded={open}
            onClick={() => onOpenChange(!open)}
          >
            <Icon name="minus" size={14} />
          </button>
        )}
        <Link
          href={`/stock/${symbol}`}
          className={styles.main}
          tabIndex={editing ? -1 : undefined}
          aria-disabled={editing || undefined}
          onClick={(e) => editing && e.preventDefault()}
        >
          <span className={styles.glyph}>
            <RadarGlyph scores={summary?.shape ?? FLAT} size={40} />
          </span>
          <span className={styles.ident}>
            <span className={styles.symbol}>{symbol}</span>
            <span className={styles.name}>{name ?? "No longer in the S&P 500 or Nasdaq-100"}</span>
            <Status data={data} />
          </span>
          <span className={styles.figures}>
            {summary ? (
              <>
                <span className={styles.price}>{formatPrice(summary.price, summary.currency)}</span>
                {summary.grade && ratio !== null ? (
                  <span
                    className={cx(styles.grade, styles[summary.grade.tone])}
                    title={`${summary.total.points} points over ${summary.total.scoredCount} scored metrics`}
                  >
                    {summary.grade.label} <b>{Math.round(ratio * 100)}%</b>
                  </span>
                ) : (
                  <span className={styles.grade}>Not graded</span>
                )}
              </>
            ) : data?.loading ? (
              <>
                <Skeleton style={{ width: "4.5rem", height: "0.95rem" }} />
                <Skeleton style={{ width: "5.5rem", height: "1.35rem", borderRadius: "999px" }} />
              </>
            ) : null}
          </span>
          {!editing && <Icon name="chevronRight" size={16} className={styles.chevron} />}
        </Link>
        {editing && (
          <button
            type="button"
            className={styles.grip}
            aria-label={`Move ${symbol}: drag, or use the up and down arrow keys`}
            {...handle}
          >
            <Icon name="grip" size={18} />
          </button>
        )}
      </div>
    </SwipeActions>
  );
}

function Status({ data }: { data: RowData | undefined }) {
  if (!data) return null;
  if (data.error && !data.quote) return <span className={cx(styles.status, styles.error)}>Couldn&apos;t load market data</span>;
  if (data.error && data.quote)
    return (
      <span className={cx(styles.status, styles.error)}>
        Not refreshed · as of <LocalTime iso={data.quote.fundamentals.asOf} />
      </span>
    );
  if (data.summary?.demo) return <span className={styles.status}>Demo data</span>;
  if (data.summary && !data.summary.claudeScored) return <span className={styles.status}>Market data only</span>;
  return null;
}
