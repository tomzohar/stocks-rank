import { describe, expect, it } from "vitest";
import { adviseLatest } from "./advice";
import { actionCopy, checkCopy, formatDay, keyPointCopy, priceFormatter, RULE_TEXT } from "./copy";
import { DAY_MS } from "./rules";
import { computeSignals, type Bar } from "./series";

const T0 = Date.UTC(2025, 0, 1);
const daily = (closes: number[]): Bar[] => closes.map((close, i) => ({ t: T0 + i * DAY_MS, close }));
const fmt = priceFormatter("USD");

// Up to 200, then down to 150: 25% under the high, and down on the month.
const bars = daily([...Array.from({ length: 60 }, (_, i) => 100 + (100 * i) / 59), ...Array.from({ length: 31 }, (_, i) => 200 - (50 * (i + 1)) / 31)]);
const signals = computeSignals(bars);

describe("DCA copy", () => {
  it("states the rules with whole percentages", () => {
    expect(RULE_TEXT.trimSmall).toEqual({ when: "Up 50% on your average", then: "Trim 10%" });
    expect(RULE_TEXT.dip).toEqual({ when: "20% under the 52-week high", then: "Buy 2×" });
    expect(RULE_TEXT.hot.then).toBe("Buy 0.5×");
  });

  it("explains a double-down call", () => {
    const a = adviseLatest(bars, signals, null)!;
    const c = actionCopy(a, "ACME", fmt);
    expect(c.title).toBe("Double down");
    expect(c.detail).toContain("25.0% under its 52-week high of $200");
    expect(c.nextBuy).toBeNull();
  });

  it("leads with the trim and still sizes the next buy", () => {
    const a = adviseLatest(bars, signals, 70)!;
    expect(actionCopy(a, "ACME", fmt)).toMatchObject({ title: "Trim 20%", tone: "critical", nextBuy: "Next buy: 2×" });
  });

  it("asks for the average price before judging a trim", () => {
    const a = adviseLatest(bars, signals, null)!;
    expect(checkCopy(a.checks[0], a, fmt).status).toBe("Needs your price");
  });

  it("says how far a rule is from firing", () => {
    const a = adviseLatest(bars, signals, 120)!;
    const small = checkCopy(a.checks.find((c) => c.id === "trimSmall")!, a, fmt);
    expect(small.status).toBe("Not now");
    expect(small.reading).toBe("Up 25.0% on $120.00. Fires at $180.00, 20.0% higher.");
  });

  it("formats days in UTC", () => {
    expect(formatDay(Date.UTC(2025, 2, 4, 23))).toBe("Mar 4, 2025");
  });

  it("describes a dip and how it played out", () => {
    const copy = keyPointCopy(
      { kind: "dip", i: 0, t: T0, price: 80, value: 0.31, after: { change: 0.12, days: 91 } },
      fmt,
    );
    expect(copy.detail).toBe("Jan 1, 2025 at $80.00; the bottom was 31.0% under the high. Buys doubled. Three months later: +12.0%.");
  });
});
