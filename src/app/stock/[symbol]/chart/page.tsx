import { Suspense } from "react";
import { DcaView } from "@/features/dca/components/DcaView";
import { getPriceHistory, getStockReport } from "@/features/market-data/report";
import { StockHeader } from "@/features/scorecard/components/StockHeader";
import { WatchButton } from "@/features/watchlist/components/WatchButton";
import { MarketDataError, ReportSkeleton, resolveStock, StockTabs } from "../shared";
import styles from "../page.module.css";

/** Fewer daily closes than this can't place a 52-week high or a month's change with any meaning. */
const MIN_CANDLES = 30;

export default function ChartPage({ params }: PageProps<"/stock/[symbol]/chart">) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <Chart params={params} />
    </Suspense>
  );
}

async function Chart({ params }: { params: PageProps<"/stock/[symbol]/chart">["params"] }) {
  const stock = await resolveStock(params, "chart");
  const [report, history] = await Promise.allSettled([
    getStockReport(stock.symbol, stock.name),
    getPriceHistory(stock.symbol, stock.name),
  ]);
  if (report.status === "rejected") {
    console.error(`Market data for ${stock.symbol} failed:`, report.reason);
    return <MarketDataError symbol={stock.symbol} />;
  }
  if (history.status === "rejected") console.error(`Price history for ${stock.symbol} failed:`, history.reason);
  const candles = history.status === "fulfilled" ? history.value.candles : [];
  return (
    <div className={`${styles.report} reveal`}>
      <StockHeader stock={stock} fundamentals={report.value.fundamentals} actions={<WatchButton symbol={stock.symbol} />} />
      <StockTabs symbol={stock.symbol} active="chart" />
      {history.status === "fulfilled" && candles.length >= MIN_CANDLES ? (
        <DcaView symbol={stock.symbol} history={history.value} />
      ) : (
        <MarketDataError symbol={stock.symbol} what="price history" />
      )}
    </div>
  );
}
