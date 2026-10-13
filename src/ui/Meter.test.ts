import { describe, expect, it } from "vitest";
import { bandIndex, meterPosition } from "./Meter";

describe("meter", () => {
  it("places values and flags overflow", () => {
    expect(meterPosition(5, 0, 10)).toEqual({ pct: 50, overflow: null });
    expect(meterPosition(-1, 0, 10)).toEqual({ pct: 0, overflow: "low" });
    expect(meterPosition(11, 0, 10)).toEqual({ pct: 100, overflow: "high" });
  });

  it("puts a value on a cut-off in the upper band", () => {
    const bands = [
      { to: 1, tone: "critical" as const },
      { to: 2, tone: "warning" as const },
      { to: 4, tone: "good" as const },
    ];
    expect(bandIndex(bands, 0.5)).toBe(0);
    expect(bandIndex(bands, 1)).toBe(1);
    expect(bandIndex(bands, 2)).toBe(2);
    expect(bandIndex(bands, 9)).toBe(2);
  });
});
