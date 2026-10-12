import type { Metadata } from "next";
import Link from "next/link";
import { StockPicker } from "@/components/StockPicker";
import { UNIVERSE_DATE } from "@/lib/universe";
import "./globals.css";

export const metadata: Metadata = {
  title: "stocks-rank",
  description: "Score S&P 500 and Nasdaq-100 stocks on 13 metrics",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <Link href="/" className="brand">
            stocks-rank
          </Link>
          <StockPicker />
        </header>
        <main className="app-main">{children}</main>
        <footer className="app-footer">
          Market data from Yahoo Finance, delayed and unofficial. Index membership as of {UNIVERSE_DATE}. Not
          investment advice.
        </footer>
      </body>
    </html>
  );
}
