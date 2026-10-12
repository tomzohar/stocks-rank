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
