import type { Metadata } from "next";
import { WatchlistView } from "@/features/watchlist/components/WatchlistView";

export const metadata: Metadata = { title: "Watchlist · stocks-rank" };

// The list lives in the browser, so the page is a shell that fills in on load.
export default function WatchlistPage() {
  return <WatchlistView />;
}
