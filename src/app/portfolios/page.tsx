import type { Metadata } from "next";
import { PortfoliosView } from "@/features/portfolio/components/PortfoliosView";

export const metadata: Metadata = { title: "Portfolios · stocks-rank" };

// Portfolios live in the browser, so the page is a shell that fills in on load.
export default function PortfoliosPage() {
  return <PortfoliosView />;
}
