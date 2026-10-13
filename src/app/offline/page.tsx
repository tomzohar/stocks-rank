import Link from "next/link";
import { Callout } from "@/ui/Callout";

export const metadata = { title: "Offline · stocks-rank" };

/** Shown by the service worker when a page isn't available offline. */
export default function OfflinePage() {
  return (
    <Callout tone="warning" icon="offline" title="You're offline">
      <p>
        This page hasn&apos;t been opened on this device before, so it isn&apos;t saved. Stocks you&apos;ve already
        opened still work offline, with the market data from your last visit and Claude&apos;s saved scores.
      </p>
      <p>
        <Link href="/">Back to start</Link>
      </p>
    </Callout>
  );
}
