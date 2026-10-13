import Link from "next/link";
import { Callout } from "@/ui/Callout";

export default function StockNotFound() {
  return (
    <Callout tone="neutral" icon="search" title="Not in the universe">
      <p>stocks-rank covers the S&amp;P 500 and the Nasdaq-100. Pick a stock from the search above.</p>
      <p>
        <Link href="/">Back to start</Link>
      </p>
    </Callout>
  );
}
