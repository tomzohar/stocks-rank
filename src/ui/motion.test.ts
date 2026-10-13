import { describe, expect, it } from "vitest";
import { easeOutCubic, interpolate } from "./motion";

describe("motion", () => {
  it("interpolates from missing values as 0", () => {
    expect(interpolate([10], [0, 10], 0.5)).toEqual([5, 5]);
    expect(interpolate([], [4], 1)).toEqual([4]);
  });

  it("eases out: fast start, exact ends", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
