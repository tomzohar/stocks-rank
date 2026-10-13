import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getStockReport, type StockReport } from "@/features/market-data/report";
import { Scorecard } from "@/features/scorecard/components/Scorecard";
import { StockHeader } from "@/features/scorecard/components/StockHeader";
import { findStock } from "@/features/universe/universe";
import { Callout } from "@/ui/Callout";
import { Panel } from "@/ui/Panel";
import { Skeleton } from "@/ui/Skeleton";
import styles from "./page.module.css";

export default function StockPage({ params }: PageProps<"/stock/[symbol]">) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <Report params={params} />
    </Suspense>
  );
}

async function Report({ params }: { params: PageProps<"/stock/[symbol]">["params"] }) {
  const { symbol } = await params;
  const stock = findStock(decodeURIComponent(symbol));
  if (!stock) notFound();
  if (stock.symbol !== symbol) redirect(`/stock/${stock.symbol}`);

  let report: StockReport;
  try {
    report = await getStockReport(stock.symbol, stock.name);
  } catch (err) {
    // Production builds redact server error messages, so log the cause here.
    console.error(`Market data for ${stock.symbol} failed:`, err);
    return (
      <Callout tone="critical" role="alert" title={`Couldn't load market data for ${stock.symbol}`}>
        Yahoo Finance may be rate-limiting or unreachable. Try again in a minute.
      </Callout>
    );
  }
  // Claude's scores (metrics 8–13) are fetched in the browser with the viewer's own key.
  return (
    <div className={`${styles.report} reveal`}>
      <StockHeader stock={stock} fundamentals={report.fundamentals} />
      <Scorecard stock={stock} {...report} />
    </div>
  );
}

function ReportSkeleton() {
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
