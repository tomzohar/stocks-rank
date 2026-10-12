import { analysisSubject, getAnalysis } from "@/lib/analysis";
import { getStockReport } from "@/lib/report";
import { findStock } from "@/lib/universe";

export const maxDuration = 300;

/**
 * GET /api/stock/AAPL → { stock, fundamentals, scores, analysis } as JSON.
 * `scores` covers metrics 1–7; `analysis` holds Claude's scores for 8–13.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/stock/[symbol]">) {
  const { symbol } = await ctx.params;
  const stock = findStock(decodeURIComponent(symbol));
  if (!stock) {
    return Response.json({ error: `${symbol} is not in the S&P 500 or Nasdaq-100` }, { status: 404 });
  }
  try {
    const [report, analysis] = await Promise.all([
      getStockReport(stock.symbol, stock.name),
      getAnalysis(analysisSubject(stock)),
    ]);
    return Response.json({ stock, ...report, analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Market data unavailable: ${message}` }, { status: 502 });
  }
}
