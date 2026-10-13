import { axisAngle, polar, ring, scorePolygon, toPoints } from "./geometry";
import styles from "./RadarGlyph.module.css";

/** A decorative, label-free radar: the brand mark and the home page illustration. */
export function RadarGlyph({ scores, size = 28, sweep = false }: { scores: readonly number[]; size?: number; sweep?: boolean }) {
  const n = scores.length;
  const c = 50;
  const r = 42;
  return (
    <svg className={styles.glyph} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx={c} cy={c} r={r + 4} className={styles.disk} />
      {[0.5, 1].map((k) => (
        <polygon key={k} className={styles.ring} points={toPoints(ring(n, c, c, r * k))} />
      ))}
      {scores.map((_, i) => {
        const e = polar(c, c, r, axisAngle(i, n));
        return <line key={i} className={styles.spoke} x1={c} y1={c} x2={e.x} y2={e.y} />;
      })}
      {sweep && (
        <g className={styles.sweep}>
          <path d={`M${c},${c} L${c},${c - r} A${r},${r} 0 0 0 ${polar(c, c, r, -Math.PI / 2 - 0.6).x},${polar(c, c, r, -Math.PI / 2 - 0.6).y} Z`} />
        </g>
      )}
      <polygon className={styles.shape} points={toPoints(scorePolygon(scores, 10, c, c, r))} />
    </svg>
  );
}
