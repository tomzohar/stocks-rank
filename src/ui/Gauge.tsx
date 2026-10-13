"use client";

import type { ReactNode } from "react";
import { useTween } from "./motion";
import styles from "./Gauge.module.css";

const SIZE = 168;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
/** The ring is open at the bottom: 270° of travel. */
const SWEEP = 0.75;

/**
 * A 270° ring that fills to `value / max`, animating on change. The centre
 * holds whatever the caller passes (the number itself, so it isn't colour-only).
 */
export function Gauge({ value, max, children, label }: { value: number; max: number; children?: ReactNode; label: string }) {
  const [shown] = useTween([value]);
  const frac = max === 0 ? 0 : Math.max(0, Math.min(1, shown / max));
  const track = C * SWEEP;
  const ticks = Array.from({ length: 11 }, (_, i) => i / 10);
  return (
    <div className={styles.gauge} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <defs>
          <linearGradient id="gauge-fill" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--series)" />
            <stop offset="100%" stopColor="var(--series-bright)" />
          </linearGradient>
        </defs>
        <g transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            className={styles.track}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            strokeWidth={STROKE}
            strokeDasharray={`${track} ${C}`}
          />
          <circle
            className={styles.fill}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            strokeWidth={STROKE}
            stroke="url(#gauge-fill)"
            strokeDasharray={`${track * frac} ${C}`}
          />
          {ticks.map((t) => {
            const a = t * SWEEP * 2 * Math.PI;
            const r1 = R - STROKE / 2 - 4;
            const r2 = r1 - (t === 0.5 || t === 0 || t === 1 ? 6 : 3);
            return (
              <line
                key={t}
                className={styles.tick}
                x1={SIZE / 2 + r1 * Math.cos(a)}
                y1={SIZE / 2 + r1 * Math.sin(a)}
                x2={SIZE / 2 + r2 * Math.cos(a)}
                y2={SIZE / 2 + r2 * Math.sin(a)}
              />
            );
          })}
        </g>
      </svg>
      <div className={styles.center}>{children}</div>
    </div>
  );
}
