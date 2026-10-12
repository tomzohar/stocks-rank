const isNum = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);

/** 0.1234 → "12.3%". */
export function formatPercent(n: number | null | undefined, { signed = false } = {}): string {
  if (!isNum(n)) return "—";
  const pct = (n * 100).toFixed(1);
  return signed && n > 0 ? `+${pct}%` : `${pct}%`;
}

/** 1.234e10, "USD" → "$12.3B". Falls back to an ISO code prefix for other currencies. */
export function formatMoney(n: number | null | undefined, currency: string | null = "USD"): string {
  if (!isNum(n)) return "—";
  const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  if (!currency || currency === "USD") return n < 0 ? `-$${compact.slice(1)}` : `$${compact}`;
  return `${currency} ${compact}`;
}

export function formatPrice(n: number | null | undefined, currency: string | null): string {
  if (!isNum(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

/** Percentage-point gap: 0.153 → "+15.3 pts". */
export function formatPoints(n: number | null | undefined): string {
  if (!isNum(n)) return "—";
  const pts = (n * 100).toFixed(1);
  return `${n > 0 ? "+" : ""}${pts} pts`;
}
