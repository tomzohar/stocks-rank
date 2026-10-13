// Offline demo data, enabled with STOCKS_RANK_DATA=demo. Deterministic per
// symbol so screenshots and UI work are repeatable without network access.
// The UI labels it as demo data; it is not a guess at the real figures.
import type { StockFundamentals } from "./fundamentals";
import { HISTORY_YEARS, type Candle, type PriceHistory } from "./history";

/** Small seeded PRNG (mulberry32). */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function demoFundamentals(symbol: string, name: string, now = new Date()): StockFundamentals {
  const r = rng(hash(symbol));
  const between = (lo: number, hi: number) => lo + (hi - lo) * r();
  const debt = between(1e9, 6e10);
  const revenueGrowth = between(-0.05, 0.45);
  return {
    symbol,
    name,
    currency: "USD",
    price: Math.round(between(20, 900) * 100) / 100,
    financialCurrency: "USD",
    totalCash: debt * between(0.3, 3),
    totalDebt: debt,
    revenueGrowth,
    expenseGrowth: revenueGrowth + between(-0.1, 0.08),
    growthPeriod: `FY${now.getUTCFullYear() - 2} → FY${now.getUTCFullYear() - 1}`,
    operatingMargin: between(-0.05, 0.45),
    shortPercentOfFloat: between(0.005, 0.14),
    institutionalOwnership: between(0.2, 0.95),
    fiveYearReturn: between(-0.3, 3),
    sp500FiveYearReturn: 0.82,
    asOf: now.toISOString(),
    source: "demo",
  };
}

const DAY_MS = 86_400_000;

/**
 * A made-up daily price path that ends at `endPrice`: a random walk whose
 * drift switches every couple of months, so rallies and drawdowns (and with
 * them every DCA rule) show up. Deterministic per symbol and day.
 */
export function demoHistory(symbol: string, endPrice: number, now = new Date()): PriceHistory {
  const r = rng(hash(`${symbol}:history`));
  const normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 20);
  const days: number[] = [];
  for (let t = end - HISTORY_YEARS * 365 * DAY_MS; t <= end; t += DAY_MS) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(t);
  }
  const vol = 0.012 + r() * 0.012;
  let drift = 0;
  let log = 0;
  const path: { t: number; open: number; close: number; spread: number }[] = [];
  days.forEach((t, i) => {
    if (i % 45 === 0) drift = (r() - 0.42) * 0.008;
    const open = log + normal() * vol * 0.25;
    log = open + drift + normal() * vol;
    path.push({ t, open, close: log, spread: Math.abs(normal()) * vol * 0.7 });
  });
  const shift = Math.log(endPrice) - log;
  const px = (n: number) => Math.round(Math.exp(n + shift) * 100) / 100;
  const candles: Candle[] = path.map((p) => {
    const open = px(p.open);
    const close = px(p.close);
    return {
      t: p.t,
      open,
      close,
      high: Math.round(Math.max(open, close) * (1 + p.spread) * 100) / 100,
      low: Math.round(Math.min(open, close) * (1 - p.spread) * 100) / 100,
    };
  });
  return { symbol, currency: "USD", candles, asOf: now.toISOString(), source: "demo" };
}
