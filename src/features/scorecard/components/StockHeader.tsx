import type { ReactNode } from "react";
import type { StockFundamentals } from "@/features/market-data/fundamentals";
import { INDEX_LABELS, type Stock } from "@/features/universe/universe";
import { formatPrice } from "@/lib/format";
import { Callout } from "@/ui/Callout";
import { LocalTime } from "@/ui/LocalTime";
import styles from "./StockHeader.module.css";

/** Ticker, name, sector, index membership and the latest price, with room for actions. */
export function StockHeader({
  stock,
  fundamentals: f,
  actions,
}: {
  stock: Stock;
  fundamentals: StockFundamentals;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.tags}>
          {stock.sector && <span className={styles.sector}>{stock.sector}</span>}
          {stock.indexes.map((i) => (
            <span key={i} className={styles.index}>
              {INDEX_LABELS[i]}
            </span>
          ))}
        </div>
        <h1 className={styles.title}>
          <span className={styles.symbol}>{stock.symbol}</span>
          <span className={styles.name}>{f.name || stock.name}</span>
        </h1>
      </div>
      <div className={styles.quote}>
        <span className={styles.price}>{formatPrice(f.price, f.currency)}</span>
        <span className={styles.asOf}>
          <i className={styles.dot} aria-hidden="true" />
          Delayed quote · <LocalTime iso={f.asOf} />
        </span>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {f.source === "demo" && (
        <Callout tone="warning" className={styles.demo} title="Demo data">
          Generated offline for development. These are not real figures.
        </Callout>
      )}
    </header>
  );
}
