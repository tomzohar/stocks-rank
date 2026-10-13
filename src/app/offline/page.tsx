import Link from "next/link";

export const metadata = { title: "Offline · stocks-rank" };

/** Shown by the service worker when a page isn't available offline. */
export default function OfflinePage() {
  return (
    <section className="panel notice">
      <h2>You&apos;re offline</h2>
      <p>
        This page hasn&apos;t been opened on this device before, so it isn&apos;t saved. Stocks you&apos;ve already
        opened still work offline, with the market data from your last visit and Claude&apos;s saved scores.
      </p>
      <p>
        <Link href="/">Back to start</Link>
      </p>
    </section>
  );
}
