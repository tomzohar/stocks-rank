// What both stock tabs share: resolving the symbol, the tab bar, and the
// loading and error states.
import { notFound, redirect } from "next/navigation";
import { findStock, type Stock } from "@/features/universe/universe";
import { Callout } from "@/ui/Callout";
import { Panel } from "@/ui/Panel";
import { Skeleton } from "@/ui/Skeleton";
import { TabLinks } from "@/ui/TabLinks";
import styles from "./page.module.css";

export type StockTab = "scorecard" | "chart";

const tabPath = (symbol: string, tab: StockTab) => `/stock/${symbol}${tab === "chart" ? "/chart" : ""}`;

/** The stock in the URL, redirecting "aapl" to "AAPL" on the same tab. */
export async function resolveStock(params: Promise<{ symbol: string }>, tab: StockTab): Promise<Stock> {
  const { symbol } = await params;
  const stock = findStock(decodeURIComponent(symbol));
  if (!stock) notFound();
  if (stock.symbol !== symbol) redirect(tabPath(stock.symbol, tab));
  return stock;
}

export function StockTabs({ symbol, active }: { symbol: string; active: StockTab }) {
  return (
    <TabLinks
      label={`${symbol} views`}
      className={styles.tabs}
      active={active === "chart" ? 1 : 0}
      tabs={[
        { href: tabPath(symbol, "scorecard"), label: "Scorecard", icon: "sparkle" },
        { href: tabPath(symbol, "chart"), label: "DCA Chart", icon: "chart" },
      ]}
    />
  );
}

export function MarketDataError({ symbol, what = "market data" }: { symbol: string; what?: string }) {
  return (
    <Callout tone="critical" role="alert" title={`Couldn't load ${what} for ${symbol}`}>
      Yahoo Finance may be rate-limiting or unreachable. Try again in a minute.
    </Callout>
  );
}

export function ReportSkeleton() {
  return (
    <div className={styles.report} aria-busy="true" aria-label="Loading stock data">
      <div className={styles.skeletonHead}>
        <Skeleton style={{ width: "6rem", height: "1.2rem" }} />
        <Skeleton style={{ width: "14rem", height: "2.6rem" }} />
      </div>
      <div className={styles.skeletonGrid}>
        <Panel>
          <Skeleton style={{ height: "24rem" }} />
        </Panel>
        <Panel>
          <Skeleton style={{ height: "10rem", marginBottom: "1rem" }} />
          <Skeleton style={{ height: "1rem", width: "70%" }} />
        </Panel>
      </div>
    </div>
  );
}
