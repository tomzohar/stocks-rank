import { describe, expect, it } from "vitest";
import { adviseLatest, parsePriceInput } from "./advice";
import { toMonthly, dayKey, type Candle } from "./candles";
import { keyPoints } from "./keypoints";
import { buySizing, DAY_MS, formatMultiplier, trimFor } from "./rules";
import { computeSignals, indexAtOrAfter, runs, type Bar } from "./series";

const T0 = Date.UTC(2024, 0, 1);
/** One bar per calendar day from T0. */
const daily = (closes: number[]): Bar[] => closes.map((close, i) => ({ t: T0 + i * DAY_MS, close }));

describe("rules", () => {
  it("doubles down 20% under the high and halves after a 20% month", () => {
    expect(buySizing(0.19, 0.1)).toEqual({ multiplier: 1, reasons: [] });
    expect(buySizing(0.2, null)).toEqual({ multiplier: 2, reasons: ["dip"] });
    expect(buySizing(null, 0.2)).toEqual({ multiplier: 0.5, reasons: ["hot"] });
  });

  it("stacks the multipliers when both buy rules fire", () => {
    expect(buySizing(0.3, 0.25)).toEqual({ multiplier: 1, reasons: ["dip", "hot"] });
  });

  it("trims 10% at +50% and 20% at +100%, the larger winning", () => {
    expect(trimFor(null)).toBeNull();
    expect(trimFor(0.49)).toBeNull();
    expect(trimFor(0.5)).toEqual({ level: "small", fraction: 0.1 });
    expect(trimFor(1.4)).toEqual({ level: "large", fraction: 0.2 });
  });

  it("formats multipliers", () => {
    expect([2, 1, 0.5].map(formatMultiplier)).toEqual(["2×", "1×", "0.5×"]);
  });
});

describe("computeSignals", () => {
  it("tracks the trailing 52-week closing high and the drawdown from it", () => {
    const bars = daily([100, 120, 90, 96]);
    const s = computeSignals(bars);
    expect(s.high.map((h) => h.price)).toEqual([100, 120, 120, 120]);
    expect(s.high[3].i).toBe(1);
    expect(s.drawdown[2]).toBeCloseTo(0.25);
  });

  it("lets a high older than 52 weeks fall out of the window", () => {
    const bars: Bar[] = [
      { t: T0, close: 200 },
      { t: T0 + 100 * DAY_MS, close: 150 },
      { t: T0 + 366 * DAY_MS, close: 140 },
    ];
    const s = computeSignals(bars);
    expect(s.high[2]).toEqual({ price: 150, i: 1 });
  });

  it("compares with the close about a month earlier, or nothing if history is short", () => {
    const bars = daily(Array.from({ length: 40 }, (_, i) => 100 + i));
    const s = computeSignals(bars);
    expect(s.monthChange[29]).toBeNull();
    expect(s.monthAgo[30]).toBe(0);
    expect(s.monthChange[30]).toBeCloseTo(130 / 100 - 1);
  });

  it("skips a month-ago close when a long gap leaves none nearby", () => {
    const bars: Bar[] = [
      { t: T0, close: 100 },
      { t: T0 + 60 * DAY_MS, close: 130 },
    ];
    expect(computeSignals(bars).monthChange[1]).toBeNull();
  });
});

describe("runs and lookups", () => {
  it("groups consecutive flags", () => {
    expect(runs([false, true, true, false, true])).toEqual([
      { from: 1, to: 2 },
      { from: 4, to: 4 },
    ]);
  });

  it("finds the first bar on or after a time", () => {
    const bars = daily([1, 2, 3]);
    expect(indexAtOrAfter(bars, T0 + DAY_MS / 2)).toBe(1);
    expect(indexAtOrAfter(bars, T0 + 10 * DAY_MS)).toBe(2);
  });
});

describe("adviseLatest", () => {
  // Climbs to 200, then slides to 150: 25% under the high.
  const climb = Array.from({ length: 60 }, (_, i) => 100 + (100 * i) / 59);
  const slide = Array.from({ length: 31 }, (_, i) => 200 - (50 * (i + 1)) / 31);
  const bars = daily([...climb, ...slide]);
  const s = computeSignals(bars);

  it("doubles down in the dip zone and leaves the trims open without a buy price", () => {
    const a = adviseLatest(bars, s, null)!;
    expect(a.action).toBe("double");
    expect(a.sizing.multiplier).toBe(2);
    expect(a.high.price).toBe(200);
    expect(a.checks.find((c) => c.id === "dip")).toMatchObject({ triggered: true, triggerPrice: 160 });
    expect(a.checks.find((c) => c.id === "trimSmall")?.triggered).toBeNull();
    expect(a.levels.map((l) => l.id)).not.toContain("avg");
  });

  it("puts a trim first once the buy price is in", () => {
    const a = adviseLatest(bars, s, 70)!;
    expect(a.gain).toBeCloseTo(150 / 70 - 1);
    expect(a.action).toBe("trimLarge");
    expect(a.sizing.multiplier).toBe(2);
    expect(a.levels.map((l) => l.id)).toEqual(expect.arrayContaining(["avg", "trimSmall", "trimLarge"]));
    expect(a.levels.find((l) => l.id === "trimLarge")?.price).toBe(140);
    expect(a.levels.map((l) => l.price)).toEqual([...a.levels.map((l) => l.price)].sort((x, y) => y - x));
  });

  it("buys half after a 20% month", () => {
    const up = daily(Array.from({ length: 40 }, (_, i) => 100 * 1.01 ** i));
    expect(adviseLatest(up, computeSignals(up), null)!.action).toBe("half");
  });

  it("reports no advice without data", () => {
    expect(adviseLatest([], computeSignals([]), null)).toBeNull();
  });
});

describe("parsePriceInput", () => {
  it("accepts plain and formatted prices", () => {
    expect(parsePriceInput("$1,234.50")).toBe(1234.5);
    expect(parsePriceInput(" 98.2 ")).toBe(98.2);
    expect(parsePriceInput(".5")).toBe(0.5);
  });
  it("rejects anything else", () => {
    for (const bad of ["", "0", "-3", "abc", "1.2.3", "1e3"]) expect(parsePriceInput(bad)).toBeNull();
  });
});

describe("keyPoints", () => {
  it("marks the high, each fall into the zone with what followed, and trim crossings", () => {
    const closes = [
      ...Array.from({ length: 30 }, () => 100),
      ...Array.from({ length: 30 }, () => 75), // 25% under the high
      ...Array.from({ length: 100 }, () => 90),
    ];
    const bars = daily(closes);
    const points = keyPoints(bars, computeSignals(bars), 0, 55);
    const dip = points.find((p) => p.kind === "dip")!;
    expect(dip.i).toBe(30);
    expect(dip.value).toBeCloseTo(0.25);
    expect(dip.after?.change).toBeCloseTo(90 / 75 - 1);
    expect(points.some((p) => p.kind === "high")).toBe(true);
    // 55 × 1.5 = 82.5: above from the first bar, then crossed again on the recovery.
    expect(points.filter((p) => p.kind === "trimSmall").map((p) => p.i)).toEqual([0, 60]);
    expect(points.some((p) => p.kind === "trimLarge")).toBe(false);
    expect(points.map((p) => p.t)).toEqual([...points.map((p) => p.t)].sort((x, y) => x - y));
  });

  it("only looks from the start of the range", () => {
    const bars = daily([100, 70, 70, 100, 100, 100]);
    expect(keyPoints(bars, computeSignals(bars), 3, null).some((p) => p.kind === "dip")).toBe(false);
  });
});

describe("candles", () => {
  it("rolls days up into months", () => {
    const c = (iso: string, open: number, high: number, low: number, close: number): Candle => ({
      t: Date.parse(iso),
      open,
      high,
      low,
      close,
    });
    const months = toMonthly([c("2025-01-02", 10, 12, 9, 11), c("2025-01-30", 11, 15, 8, 14), c("2025-02-03", 14, 16, 13, 15)]);
    expect(months).toEqual([
      { key: "2025-01-01", t: Date.parse("2025-01-02"), open: 10, high: 15, low: 8, close: 14 },
      { key: "2025-02-01", t: Date.parse("2025-02-03"), open: 14, high: 16, low: 13, close: 15 },
    ]);
    expect(dayKey(Date.parse("2025-02-03T14:30:00Z"))).toBe("2025-02-03");
  });
});
