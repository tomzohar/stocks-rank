import { describe, expect, it } from "vitest";
import { arcPath, axisAngle, halfStep, ring, scorePolygon, sectorPath, toPoints } from "./geometry";

describe("radar geometry", () => {
  it("starts at 12 o'clock and runs clockwise", () => {
    expect(axisAngle(0, 4)).toBeCloseTo(-Math.PI / 2);
    expect(axisAngle(1, 4)).toBeCloseTo(0); // 3 o'clock
  });

  it("scales each vertex by its score", () => {
    const [top, right, bottom, left] = scorePolygon([10, 5, 0, null], 10, 100, 100, 50);
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50);
    expect(right.x).toBeCloseTo(125);
    expect(right.y).toBeCloseTo(100);
    expect(bottom).toEqual({ x: 100, y: 100 });
    expect(left.x).toBeCloseTo(100);
  });

  it("builds rings and SVG point lists", () => {
    expect(ring(13, 0, 0, 1)).toHaveLength(13);
    expect(toPoints([{ x: 1, y: 2.345 }, { x: 0, y: 0 }])).toBe("1.00,2.35 0.00,0.00");
  });
});

describe("arcs and sectors", () => {
  it("draws a quarter arc clockwise from 12 o'clock", () => {
    expect(arcPath(0, 0, 10, -Math.PI / 2, 0)).toBe("M0.00,-10.00 A10,10 0 0 1 10.00,0.00");
  });

  it("flags arcs over half a turn as large", () => {
    expect(arcPath(0, 0, 10, 0, 1.5 * Math.PI)).toContain(" 0 1 1 ");
  });

  it("closes sectors through the centre", () => {
    expect(sectorPath(5, 5, 10, -Math.PI / 2, 0)).toBe("M5,5 L5.00,-5.00 A10,10 0 0 1 15.00,5.00 Z");
    expect(halfStep(13)).toBeCloseTo(Math.PI / 13);
  });
});
