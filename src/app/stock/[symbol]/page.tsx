import { Suspense } from "react";
import { getStockReport, type StockReport } from "@/features/market-data/report";
import { Scorecard } from "@/features/scorecard/components/Scorecard";
import { StockHeader } from "@/features/scorecard/components/StockHeader";
import { WatchButton } from "@/features/watchlist/components/WatchButton";
import { MarketDataError, ReportSkeleton, resolveStock, StockTabs } from "./shared";
import styles from "./page.module.css";

export default function StockPage({ params }: PageProps<"/stock/[symbol]">) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <Report params={params} />
    </Suspense>
  );
}

async function Report({ params }: { params: PageProps<"/stock/[symbol]">["params"] }) {
  const stock = await resolveStock(params, "scorecard");
  let report: StockReport;
  try {
    report = await getStockReport(stock.symbol, stock.name);
  } catch (err) {
    // Production builds redact server error messages, so log the cause here.
    console.error(`Market data for ${stock.symbol} failed:`, err);
    return <MarketDataError symbol={stock.symbol} />;
  }
  // Claude's scores (metrics 8–13) are fetched in the browser with the viewer's own key.
  return (
    <div className={`${styles.report} reveal`}>
      <StockHeader stock={stock} fundamentals={report.fundamentals} actions={<WatchButton symbol={stock.symbol} />} />
      <StockTabs symbol={stock.symbol} active="scorecard" />
      <Scorecard stock={stock} {...report} />
    </div>
  );
}
