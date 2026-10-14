import { latestReading } from "@/features/dca/reading";
import { getPriceHistory } from "@/features/market-data/report";
import { findStock } from "@/features/universe/universe";

/**
 * GET /api/stock/AAPL/dca → { symbol, reading, asOf, source }: today's close
 * against the DCA buy rules (52-week high, drawdown, one-month change).
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/stock/[symbol]/dca">) {
  const { symbol } = await ctx.params;
  const stock = findStock(decodeURIComponent(symbol));
  if (!stock) {
    return Response.json({ error: `${symbol} is not in the S&P 500 or Nasdaq-100` }, { status: 404 });
  }
  try {
    const history = await getPriceHistory(stock.symbol, stock.name);
    const reading = latestReading(history.candles.map((c) => ({ t: c.t, close: c.close })));
    return Response.json({ symbol: stock.symbol, reading, asOf: history.asOf, source: history.source });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Price history unavailable: ${message}` }, { status: 502 });
  }
}
