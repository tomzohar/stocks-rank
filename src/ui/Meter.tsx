import { cx } from "./cx";
import type { Tone } from "./tone";
import styles from "./Meter.module.css";

export interface MeterBand {
  /** Upper edge of the band; bands are contiguous from the meter's `min`. */
  to: number;
  tone: Tone;
}

export interface MeterSpec {
  min: number;
  max: number;
  bands: readonly MeterBand[];
  value: number | null;
  /** Labelled cut-offs drawn under the track. */
  ticks: readonly { at: number; label: string }[];
  /**
   * Index of the band to light up. Defaults to the band the value falls in;
   * pass it when the score decides (a value exactly on a cut-off can belong
   * to either side, depending on the rule).
   */
  active?: number;
}

/** Where `value` sits on the track (0–100%), and whether it ran off either end. */
export function meterPosition(value: number, min: number, max: number): { pct: number; overflow: "low" | "high" | null } {
  if (value < min) return { pct: 0, overflow: "low" };
  if (value > max) return { pct: 100, overflow: "high" };
  return { pct: ((value - min) / (max - min)) * 100, overflow: null };
}

/** The band a value falls in: bands own their lower edge, so a value on a cut-off belongs to the upper band. */
export function bandIndex(bands: readonly MeterBand[], value: number): number {
  const i = bands.findIndex((b) => value < b.to);
  return i === -1 ? bands.length - 1 : i;
}

const pct = (v: number, min: number, max: number) => `${((v - min) / (max - min)) * 100}%`;

/**
 * A horizontal track split into scoring bands, with a marker at the value.
 * Decorative: the value and score are always given as text next to it.
 */
export function Meter({ spec, className }: { spec: MeterSpec; className?: string }) {
  const { min, max, bands, value, ticks } = spec;
  const active = spec.active ?? (value === null ? -1 : bandIndex(bands, value));
  const pos = value === null ? null : meterPosition(value, min, max);
  return (
    <div className={cx(styles.meter, className)} aria-hidden="true">
      <div className={styles.track}>
        {bands.map((b, i) => {
          const from = i === 0 ? min : bands[i - 1].to;
          return (
            <span
              key={i}
              className={cx(styles.band, styles[b.tone], i === active && styles.active)}
              style={{ left: pct(from, min, max), width: pct(b.to - from + min, min, max) }}
            />
          );
        })}
        {pos && (
          <span
            className={cx(styles.marker, active >= 0 && styles[bands[active].tone], pos.overflow && styles.overflow)}
            style={{ left: `${pos.pct}%` }}
            data-overflow={pos.overflow ?? undefined}
          />
        )}
      </div>
      <div className={styles.ticks}>
        {ticks.map((t) => (
          <span key={t.at} style={{ left: pct(t.at, min, max) }}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
