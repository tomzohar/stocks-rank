import type { CSSProperties } from "react";
import { shares, type Holding } from "../model";
import styles from "./AllocationBar.module.css";

/** Shades of the series colour, alternating light and dark so neighbours stand apart. */
const SHADES = [100, 55, 80, 35, 68, 22];

/** The colour of the holding at `index`, for its bar segment and its dot in the list. */
export const shadeStyle = (index: number) => ({ "--shade": `${SHADES[index % SHADES.length]}%` }) as CSSProperties;

/** A stacked bar of the holdings' shares. The list beside it carries the numbers. */
export function AllocationBar({ holdings, className }: { holdings: readonly Holding[]; className?: string }) {
  const s = shares(holdings);
  return (
    <div className={`${styles.bar} ${className ?? ""}`} role="img" aria-label={holdings.map((h, i) => `${h.symbol} ${Math.round(s[i] * 100)}%`).join(", ")}>
      {holdings.map((h, i) =>
        s[i] > 0 ? <span key={h.symbol} className={styles.segment} style={{ ...shadeStyle(i), flexGrow: s[i] }} title={`${h.symbol} ${Math.round(s[i] * 100)}%`} /> : null,
      )}
    </div>
  );
}

/** The holding's colour as a small dot. */
export function ShadeDot({ index }: { index: number }) {
  return <span className={styles.dot} style={shadeStyle(index)} aria-hidden="true" />;
}
