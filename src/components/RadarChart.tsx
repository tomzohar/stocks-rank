"use client";

import { MAX_METRIC_SCORE, type MetricId, type Score } from "@/lib/scoring/metrics";
import { axisAngle, polar, ring, scorePolygon, toPoints } from "@/lib/radar";

export interface RadarAxis {
  id: MetricId;
  label: string;
  kind: "quantitative" | "qualitative";
  score: Score | null;
  /** Still being scored — labelled "…" rather than "n/a". */
  pending?: boolean;
}

// Wide side margins leave room for the axis labels, which sit outside the rings.
const W = 600;
const H = 480;
const CX = W / 2;
const CY = H / 2;
const R = 160;

export const scoreTone = (s: Score | null) => (s === null ? "none" : s === 10 ? "good" : s === 5 ? "warning" : "critical");

/**
 * The score shape: one spoke per metric, the vertex out at 10, halfway at 5,
 * at the centre for 0. Unscored metrics have no vertex and an "n/a" label.
 */
export function RadarChart({
  axes,
  highlighted,
  onHighlight,
}: {
  axes: readonly RadarAxis[];
  highlighted: MetricId | null;
  onHighlight: (id: MetricId | null) => void;
}) {
  const n = axes.length;
  const shape = scorePolygon(
    axes.map((a) => a.score),
    MAX_METRIC_SCORE,
    CX,
    CY,
    R,
  );
  const hi = axes.findIndex((a) => a.id === highlighted);

  return (
    <div className="radar">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="radar-title">
        <title id="radar-title">
          {`Score shape: ${axes.map((a) => `${a.label} ${a.score ?? "not scored"}`).join(", ")}`}
        </title>

        {/* Grid: the 5 and 10 rings, and a spoke per metric. */}
        {[5, 10].map((level) => (
          <polygon key={level} className="radar-ring" points={toPoints(ring(n, CX, CY, (R * level) / MAX_METRIC_SCORE))} />
        ))}
        {axes.map((a, i) => {
          const end = polar(CX, CY, R, axisAngle(i, n));
          return (
            <line
              key={a.id}
              className={`radar-spoke ${a.kind}`}
              x1={CX}
              y1={CY}
              x2={end.x}
              y2={end.y}
            />
          );
        })}
        {/* Ring values sit just left of the top spoke, clear of its vertex. */}
        <text className="radar-ring-label" x={CX - 8} y={CY - R / 2 + 4} textAnchor="end">
          5
        </text>
        <text className="radar-ring-label" x={CX - 8} y={CY - R + 4} textAnchor="end">
          10
        </text>

        <polygon className="radar-shape" points={toPoints(shape)} />

        {axes.map((a, i) => {
          if (a.score === null) return null;
          const p = shape[i];
          return (
            <circle
              key={a.id}
              className={`radar-vertex tone-${scoreTone(a.score)}`}
              cx={p.x}
              cy={p.y}
              r={i === hi ? 7 : 5}
            />
          );
        })}

        {/* Axis labels, with the score so colour never carries it alone. */}
        {axes.map((a, i) => {
          const angle = axisAngle(i, n);
          const p = polar(CX, CY, R + 20, angle);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          // Only the top spoke is centred; near-vertical bottom spokes lean outward so their labels don't collide.
          const anchor = cos > 0.1 ? "start" : cos < -0.1 ? "end" : "middle";
          const dy = sin < -0.5 ? "-0.2em" : sin > 0.5 ? "0.9em" : "0.35em";
          return (
            <text
              key={a.id}
              className={`radar-label ${a.kind} ${i === hi ? "is-hi" : ""}`}
              x={p.x}
              y={p.y}
              dy={dy}
              textAnchor={anchor}
            >
              {a.label}
              <tspan className="radar-label-score" dx="0.4em">
                {a.pending ? "…" : (a.score ?? "n/a")}
              </tspan>
            </text>
          );
        })}

        {/* Hit targets, larger than the marks, last so they sit on top. */}
        {axes.map((a, i) => {
          const p = polar(CX, CY, R + 6, axisAngle(i, n));
          return (
            <line
              key={a.id}
              className="radar-hit"
              x1={CX}
              y1={CY}
              x2={p.x}
              y2={p.y}
              tabIndex={0}
              aria-label={`${a.label}: ${a.pending ? "being scored" : (a.score ?? "not scored")}`}
              onMouseEnter={() => onHighlight(a.id)}
              onMouseLeave={() => onHighlight(null)}
              onFocus={() => onHighlight(a.id)}
              onBlur={() => onHighlight(null)}
            />
          );
        })}
      </svg>
      <div className="radar-legend">
        <span>
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" className="radar-spoke quantitative" />
          </svg>
          From market data
        </span>
        <span>
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" className="radar-spoke qualitative" />
          </svg>
          Scored by Claude
        </span>
      </div>
    </div>
  );
}
