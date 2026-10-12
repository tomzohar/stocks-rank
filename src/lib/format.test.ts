import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent, formatPoints, formatPrice } from "./format";

describe("format", () => {
  it("formats percentages", () => {
    expect(formatPercent(0.1234)).toBe("12.3%");
    expect(formatPercent(0.05, { signed: true })).toBe("+5.0%");
    expect(formatPercent(-0.05, { signed: true })).toBe("-5.0%");
    expect(formatPercent(null)).toBe("—");
  });

  it("formats money compactly", () => {
    expect(formatMoney(1.234e10)).toBe("$12.3B");
    expect(formatMoney(-5e6)).toBe("-$5M");
    expect(formatMoney(2.5e9, "CNY")).toBe("CNY 2.5B");
    expect(formatMoney(undefined)).toBe("—");
  });

  it("formats prices and point gaps", () => {
    expect(formatPrice(123.456, "USD")).toBe("$123.46");
    expect(formatPoints(0.153)).toBe("+15.3 pts");
    expect(formatPoints(-0.2)).toBe("-20.0 pts");
  });
});
