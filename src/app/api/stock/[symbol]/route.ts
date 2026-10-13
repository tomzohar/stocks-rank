import { getStockReport } from "@/lib/report";
import { findStock } from "@/lib/universe";

/**
 * GET /api/stock/AAPL → { stock, fundamentals, scores } as JSON (metrics 1–7).
 * Claude's scores for 8–13 run in the browser with the viewer's key.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/stock/[symbol]">) {
  const { symbol } = await ctx.params;
  const stock = findStock(decodeURIComponent(symbol));
  if (!stock) {
    return Response.json({ error: `${symbol} is not in the S&P 500 or Nasdaq-100` }, { status: 404 });
  }
  try {
    return Response.json({ stock, ...(await getStockReport(stock.symbol, stock.name)) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Market data unavailable: ${message}` }, { status: 502 });
  }
}
