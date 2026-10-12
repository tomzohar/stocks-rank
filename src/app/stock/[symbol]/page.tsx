import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Scorecard } from "@/components/Scorecard";
import { analysisSubject, getAnalysis } from "@/lib/analysis";
import { getStockReport, type StockReport } from "@/lib/report";
import { findStock, type Stock } from "@/lib/universe";

// Claude's research (web searches, then scoring) can take a minute or two.
export const maxDuration = 300;

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
      <section className="panel notice" role="alert">
        <h2>Couldn&apos;t load market data for {stock.symbol}</h2>
        <p className="muted">Yahoo Finance may be rate-limiting or unreachable. Try again in a minute.</p>
      </section>
    );
  }
  // Market-data scores render right away; Claude's scores stream in when ready.
  const fallback = <Scorecard stock={stock} {...report} analysis={{ status: "pending" }} />;
  return (
    <Suspense fallback={fallback}>
      <AnalyzedScorecard stock={stock} report={report} />
    </Suspense>
  );
}

async function AnalyzedScorecard({ stock, report }: { stock: Stock; report: StockReport }) {
  const analysis = await getAnalysis(analysisSubject(stock));
  return <Scorecard stock={stock} {...report} analysis={analysis} />;
}

function ReportSkeleton() {
  return (
    <section className="panel skeleton" aria-busy="true" aria-label="Loading stock data">
      <div className="skeleton-line wide" />
      <div className="skeleton-chart" />
    </section>
  );
}
