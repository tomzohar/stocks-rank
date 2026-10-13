import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PwaSupport } from "@/components/PwaSupport";
import { StockPicker } from "@/components/StockPicker";
import { UNIVERSE_DATE } from "@/lib/universe";
import "./globals.css";

export const metadata: Metadata = {
  title: "stocks-rank",
  description: "Score S&P 500 and Nasdaq-100 stocks on 13 metrics",
  applicationName: "stocks-rank",
  appleWebApp: { capable: true, title: "stocks-rank", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a19" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        {/* With credentials: the site sits behind Vercel's login, and without
            the cookie the browser can't read the manifest to install the app. */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body>
        <header className="app-header">
          <Link href="/" className="brand">
            stocks-rank
          </Link>
          <StockPicker />
          <PwaSupport />
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
