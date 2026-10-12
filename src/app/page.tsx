import { METRICS } from "@/lib/scoring/metrics";

export default function Home() {
  return (
    <section className="panel intro">
      <h2>Pick a stock to rank it</h2>
      <p>
        Each stock is scored 0, 5 or 10 on {METRICS.length} metrics. The first seven come from market data; the rest
        are your own judgement — set them on the stock&apos;s page and they&apos;re saved in this browser.
      </p>
      <ol className="metric-list">
        {METRICS.map((m) => (
          <li key={m.id}>
            <span>{m.label}</span>
            <span className={`tag ${m.kind}`}>{m.kind === "quantitative" ? "data" : "you"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
