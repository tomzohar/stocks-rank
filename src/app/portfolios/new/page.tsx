import type { Metadata } from "next";
import { PortfolioBuilder } from "@/features/portfolio/components/PortfolioBuilder";

export const metadata: Metadata = { title: "New Portfolio · stocks-rank" };

// The builder works on the watchlist and a draft kept in this tab.
export default function NewPortfolioPage() {
  return <PortfolioBuilder />;
}
