import { describe, expect, it } from "vitest";
import { makeRoomOffset, reorderTarget } from "./reorder";

const centers = [25, 75, 125, 175];

describe("reorderTarget", () => {
  it("stays put until the dragged centre crosses a neighbour's", () => {
    expect(reorderTarget(centers, 1, 75)).toBe(1);
    expect(reorderTarget(centers, 1, 124)).toBe(1);
    expect(reorderTarget(centers, 1, 126)).toBe(2);
    expect(reorderTarget(centers, 1, 24)).toBe(0);
  });

  it("clamps to the ends", () => {
    expect(reorderTarget(centers, 0, 900)).toBe(3);
    expect(reorderTarget(centers, 3, -900)).toBe(0);
  });
});

describe("makeRoomOffset", () => {
  it("slides the rows in between towards the gap", () => {
    // Dragging row 0 down to slot 2: rows 1 and 2 move up.
    expect([0, 1, 2, 3].map((i) => makeRoomOffset(i, 0, 2, 50))).toEqual([0, -50, -50, 0]);
    // Dragging row 3 up to slot 1: rows 1 and 2 move down.
    expect([0, 1, 2, 3].map((i) => makeRoomOffset(i, 3, 1, 50))).toEqual([0, 50, 50, 0]);
  });
});
