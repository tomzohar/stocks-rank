// Offline demo data, enabled with STOCKS_RANK_DATA=demo. Deterministic per
// symbol so screenshots and UI work are repeatable without network access.
// The UI labels it as demo data; it is not a guess at the real figures.
import type { StockFundamentals } from "./fundamentals";

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
