import { describe, expect, it } from "vitest";
import { toCandles } from "./history";

const d = (iso: string) => new Date(iso);

describe("toCandles", () => {
  it("sorts, drops bars without a close and fills missing prices", () => {
    expect(
      toCandles([
        { date: d("2025-01-03T14:30:00Z"), open: 10, high: 12, low: 9, close: 11 },
        { date: d("2025-01-02T14:30:00Z"), open: null, high: null, low: null, close: 10 },
        { date: d("2025-01-06T14:30:00Z"), open: 11, close: null },
      ]),
    ).toEqual([
      { t: Date.parse("2025-01-02T14:30:00Z"), open: 10, high: 10, low: 10, close: 10 },
      { t: Date.parse("2025-01-03T14:30:00Z"), open: 10, high: 12, low: 9, close: 11 },
    ]);
  });

  it("keeps the latest bar when a day repeats, and widens high/low to contain open and close", () => {
    const out = toCandles([
      { date: d("2025-01-02T14:30:00Z"), open: 10, high: 10.5, low: 9.5, close: 10 },
      { date: d("2025-01-02T20:00:00Z"), open: 10, high: 10.2, low: 9.9, close: 10.8 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ close: 10.8, high: 10.8, low: 9.9 });
  });
});
