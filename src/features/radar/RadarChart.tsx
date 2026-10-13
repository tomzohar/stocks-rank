"use client";

import { useState } from "react";
import { cx } from "@/ui/cx";
import { useTween } from "@/ui/motion";
import type { Tone } from "@/ui/tone";
import { arcPath, axisAngle, halfStep, polar, ring, scorePolygon, sectorPath, toPoints } from "./geometry";
import styles from "./RadarChart.module.css";

export interface RadarAxis {
  id: string;
  /** Short name for the axis. */
  label: string;
  /** Full name for the tooltip. */
  title: string;
  group: "quantitative" | "qualitative";
  score: number | null;
  tone: Tone;
  /** Still being scored: "…" rather than "n/a". */
  pending?: boolean;
  /** Tooltip lines: the figure and the rubric verdict or rationale. */
  value?: string | null;
  note?: string | null;
}

// Wide margins leave room for the axis labels outside the rings.
const W = 620;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const R = 168;
const RINGS = [2.5, 5, 7.5, 10];
const GROUP_LABEL: Record<RadarAxis["group"], string> = { quantitative: "Market data", qualitative: "Claude" };

/**
 * The score shape: one spoke per metric, out at 10, halfway at 5, at the
 * centre for 0. The shape grows in on load and morphs as scores arrive; a
 * sweep runs while some are still being scored.
 */
export function RadarChart({
  axes,
  max,
  highlighted,
  onHighlight,
  scanning,
}: {
  axes: readonly RadarAxis[];
  max: number;
  highlighted: string | null;
  onHighlight: (id: string | null) => void;
  scanning?: boolean;
}) {
  const n = axes.length;
  const [hover, setHover] = useState<number | null>(null);
  const shown = useTween(
    axes.map((a) => a.score ?? 0),
    { duration: 1100 },
  );
  const shape = scorePolygon(shown, max, CX, CY, R);
  const hi = axes.findIndex((a) => a.id === highlighted);
  const step = halfStep(n);

  const enter = (i: number) => {
    setHover(i);
    onHighlight(axes[i].id);
  };
  const leave = () => {
    setHover(null);
    onHighlight(null);
  };

  // Each group's contiguous run of spokes, for the arcs around the outside.
  const groups = (["quantitative", "qualitative"] as const)
    .map((g) => {
      const idx = axes.flatMap((a, i) => (a.group === g ? [i] : []));
      return idx.length ? { g, first: idx[0], last: idx.at(-1)! } : null;
    })
    .filter((x) => x !== null);

  const tip = hover === null ? null : axes[hover];
  // The tooltip hangs off the vertex (at least a third of the way out, so it clears the hub),
  // on the side away from the centre.
  const tipAt = hover === null ? null : polar(CX, CY, (R * Math.max(shown[hover], max / 3)) / max, axisAngle(hover, n));
  const tipRight = hover !== null && Math.cos(axisAngle(hover, n)) < -0.05;

  return (
    <div className={styles.radar}>
      <div className={styles.stage}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="radar-title">
          <title id="radar-title">
            {`Score shape: ${axes.map((a) => `${a.title} ${a.pending ? "being scored" : (a.score ?? "not scored")}`).join(", ")}`}
          </title>
          <defs>
            <radialGradient id="radar-fill" cx={CX} cy={CY} r={R} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--series)" stopOpacity="0.05" />
              <stop offset="100%" stopColor="var(--series-bright)" stopOpacity="0.38" />
            </radialGradient>
            <radialGradient id="radar-scope" cx={CX} cy={CY} r={R} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--series)" stopOpacity="0.07" />
              <stop offset="100%" stopColor="var(--series)" stopOpacity="0" />
            </radialGradient>
            <clipPath id="radar-clip">
              <circle cx={CX} cy={CY} r={R} />
            </clipPath>
          </defs>

          <circle cx={CX} cy={CY} r={R} fill="url(#radar-scope)" />
          {RINGS.map((level) => (
            <polygon
              key={level}
              className={cx(styles.ring, level % 5 === 0 ? styles.ringMajor : styles.ringMinor)}
              points={toPoints(ring(n, CX, CY, (R * level) / max))}
            />
          ))}
          {axes.map((a, i) => {
            const end = polar(CX, CY, R, axisAngle(i, n));
            return (
              <line
                key={a.id}
                className={cx(styles.spoke, styles[a.group], a.pending && styles.spokePending, i === hi && styles.spokeHi)}
                x1={CX}
                y1={CY}
                x2={end.x}
                y2={end.y}
              />
            );
          })}

          {/* Group arcs: which spokes come from market data and which from Claude. */}
          {groups.map(({ g, first, last }) => (
            <path
              key={g}
              className={cx(styles.groupArc, styles[g])}
              d={arcPath(CX, CY, R + 12, axisAngle(first, n) - step + 0.04, axisAngle(last, n) + step - 0.04)}
            >
              <title>{GROUP_LABEL[g]}</title>
            </path>
          ))}

          {scanning && (
            <g clipPath="url(#radar-clip)" aria-hidden="true">
              <g className={styles.sweep}>
                {[0.28, 0.16, 0.08, 0.04].map((o, k) => (
                  <path
                    key={o}
                    d={sectorPath(CX, CY, R, -Math.PI / 2 - (k + 1) * 0.16, -Math.PI / 2)}
                    fill="var(--series)"
                    fillOpacity={o}
                  />
                ))}
                <line x1={CX} y1={CY} x2={CX} y2={CY - R} className={styles.sweepEdge} />
              </g>
            </g>
          )}

          <text className={styles.ringLabel} x={CX - 12} y={CY - (R * 5) / max + 4} textAnchor="end">
            5
          </text>
          <text className={styles.ringLabel} x={CX - 12} y={CY - R + 4} textAnchor="end">
            10
          </text>

          <polygon className={styles.shape} points={toPoints(shape)} />

          {axes.map((a, i) =>
            a.score === null ? null : (
              <g key={a.id} className={cx(styles.vertex, styles[a.tone], i === hi && styles.vertexHi)}>
                {i === hi && <circle className={styles.halo} cx={shape[i].x} cy={shape[i].y} r={13} />}
                <circle cx={shape[i].x} cy={shape[i].y} r={i === hi ? 6.5 : 5} />
              </g>
            ),
          )}
          <circle className={styles.hub} cx={CX} cy={CY} r={3} />

          {/* Axis labels carry the score as text, so colour never carries it alone. */}
          {axes.map((a, i) => {
            const angle = axisAngle(i, n);
            const p = polar(CX, CY, R + 28, angle);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const anchor = cos > 0.1 ? "start" : cos < -0.1 ? "end" : "middle";
            const dy = sin < -0.5 ? "-0.15em" : sin > 0.5 ? "0.85em" : "0.35em";
            return (
              <text
                key={a.id}
                className={cx(styles.label, styles[a.group], i === hi && styles.labelHi)}
                x={p.x}
                y={p.y}
                dy={dy}
                textAnchor={anchor}
              >
                {a.label}
                <tspan className={cx(styles.labelScore, a.score === null && styles.labelNone)} dx="0.45em">
                  {a.pending ? "…" : (a.score ?? "n/a")}
                </tspan>
              </text>
            );
          })}

          {/* Hover targets: a slice per spoke, drawn last so they sit on top. */}
          {axes.map((a, i) => {
            const angle = axisAngle(i, n);
            return (
              <path
                key={a.id}
                className={styles.hit}
                d={sectorPath(CX, CY, R + 46, angle - step, angle + step)}
                tabIndex={0}
                aria-label={`${a.title}: ${a.pending ? "being scored" : a.score === null ? "not scored" : `${a.score} of ${max}`}${a.value ? `, ${a.value}` : ""}`}
                onMouseEnter={() => enter(i)}
                onMouseLeave={leave}
                onFocus={() => enter(i)}
                onBlur={leave}
                onClick={() => enter(i)}
              />
            );
          })}
        </svg>

        {tip && tipAt && (
          <div
            className={cx(styles.tip, tipRight && styles.tipLeft)}
            style={{ left: `${(tipAt.x / W) * 100}%`, top: `${(tipAt.y / H) * 100}%` }}
            aria-hidden="true"
          >
            <span className={styles.tipGroup}>{GROUP_LABEL[tip.group]}</span>
            <span className={styles.tipTitle}>{tip.title}</span>
            <span className={cx(styles.tipScore, styles[tip.tone])}>
              <i />
              {tip.pending ? "Scoring…" : tip.score === null ? "No score" : `${tip.score} / ${max}`}
            </span>
            {tip.value && <span className={styles.tipValue}>{tip.value}</span>}
            {tip.note && <span className={styles.tipNote}>{tip.note}</span>}
          </div>
        )}
      </div>

      <div className={styles.legend}>
        <span>
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" className={cx(styles.legendLine, styles.quantitative)} />
          </svg>
          Market data
        </span>
        <span>
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" className={cx(styles.legendLine, styles.qualitative)} />
          </svg>
          Scored by Claude
        </span>
        <span className={styles.legendTones}>
          <i className={styles.good} /> 10 <i className={styles.warning} /> 5 <i className={styles.critical} /> 0
        </span>
      </div>
    </div>
  );
}
