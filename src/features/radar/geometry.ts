// Geometry for the radar ("spider") chart: one axis per metric, evenly spaced,
// starting at 12 o'clock and running clockwise.

export interface Point {
  x: number;
  y: number;
}

export function axisAngle(index: number, count: number): number {
  return -Math.PI / 2 + (2 * Math.PI * index) / count;
}

export function polar(cx: number, cy: number, radius: number, angle: number): Point {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

/** Vertices of the score shape. Unscored metrics (null) sit at the centre. */
export function scorePolygon(
  values: readonly (number | null)[],
  max: number,
  cx: number,
  cy: number,
  radius: number,
): Point[] {
  return values.map((v, i) => polar(cx, cy, (radius * Math.max(0, Math.min(v ?? 0, max))) / max, axisAngle(i, values.length)));
}

/** A regular polygon at `radius` — the chart's grid rings. */
export function ring(count: number, cx: number, cy: number, radius: number): Point[] {
  return Array.from({ length: count }, (_, i) => polar(cx, cy, radius, axisAngle(i, count)));
}

export const toPoints = (pts: readonly Point[]): string =>
  pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

/** Half the angle between two neighbouring spokes. */
export const halfStep = (count: number) => Math.PI / count;

/** An arc along the circle of `radius`, from angle a0 to a1 (clockwise). */
export function arcPath(cx: number, cy: number, radius: number, a0: number, a1: number): string {
  const s = polar(cx, cy, radius, a0);
  const e = polar(cx, cy, radius, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${s.x.toFixed(2)},${s.y.toFixed(2)} A${radius},${radius} 0 ${large} 1 ${e.x.toFixed(2)},${e.y.toFixed(2)}`;
}

/** A pie slice from the centre: the hover target for one spoke. */
export function sectorPath(cx: number, cy: number, radius: number, a0: number, a1: number): string {
  return `M${cx},${cy} L${arcPath(cx, cy, radius, a0, a1).slice(1)} Z`;
}
