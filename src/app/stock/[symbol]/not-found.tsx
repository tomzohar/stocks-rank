import Link from "next/link";

export default function StockNotFound() {
  return (
    <section className="panel notice">
      <h2>Not in the universe</h2>
      <p>stocks-rank covers the S&amp;P 500 and the Nasdaq-100. Pick a stock from the search above.</p>
      <p>
        <Link href="/">Back to start</Link>
      </p>
    </section>
  );
}
