import Link from "next/link";
import { RadarGlyph } from "@/features/radar/RadarGlyph";
import { METRICS } from "@/features/scoring/metrics";
import { findStock, STOCKS } from "@/features/universe/universe";
import { Icon } from "@/ui/Icon";
import { Panel } from "@/ui/Panel";
import styles from "./page.module.css";

const QUICK_PICKS = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "COST", "JPM"]
  .map((s) => findStock(s))
  .filter((s) => s !== undefined);

const SAMPLE = [10, 7, 9, 5, 8, 10, 6, 9, 4, 8, 7, 10, 6];

export default function Home() {
  const quantitative = METRICS.filter((m) => m.kind === "quantitative");
  const qualitative = METRICS.filter((m) => m.kind === "qualitative");
  return (
    <div className={`${styles.home} reveal`}>
      <section className={styles.hero} style={{ "--i": 0 } as React.CSSProperties}>
        <div className={styles.heroText}>
          <p className={styles.kicker}>
            <span className={styles.pulse} aria-hidden="true" /> {STOCKS.length} stocks · S&amp;P 500 ∪ Nasdaq-100
          </p>
          <h1>
            Rank any large-cap on <span className={styles.accent}>13 metrics</span>, at a glance.
          </h1>
          <p className={styles.lede}>
            Seven scores come straight from market data. Six are judgement calls Claude makes after researching the
            company on the web, each with its reasons. Every metric scores 0, 5 or 10, and the shape tells the story.
          </p>
          <div className={styles.picks}>
            <span className={styles.picksLabel}>Try</span>
            {QUICK_PICKS.map((s) => (
              <Link key={s.symbol} href={`/stock/${s.symbol}`} className={styles.pick}>
                {s.symbol}
              </Link>
            ))}
          </div>
        </div>
        <div className={styles.heroArt}>
          <RadarGlyph scores={SAMPLE} size={260} sweep />
        </div>
      </section>

      <div className={styles.groups} style={{ "--i": 1 } as React.CSSProperties}>
        <Panel eyebrow="Metrics 1–7" title="From market data">
          <MetricList metrics={quantitative} offset={0} />
        </Panel>
        <Panel eyebrow="Metrics 8–13" title="Scored by Claude">
          <MetricList metrics={qualitative} offset={quantitative.length} />
          <p className={styles.note}>
            <Icon name="key" size={14} /> You bring your own Claude API key. It stays in your browser and goes only to
            Anthropic. Results are saved on this device for a week.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function MetricList({ metrics, offset }: { metrics: typeof METRICS; offset: number }) {
  return (
    <ol className={styles.metrics}>
      {metrics.map((m, i) => (
        <li key={m.id}>
          <span className={styles.num}>{String(offset + i + 1).padStart(2, "0")}</span>
          <span className={styles.label}>{m.label}</span>
          <span className={styles.top} title="What earns a 10">
            {m.criteria[10]}
          </span>
        </li>
      ))}
    </ol>
  );
}
