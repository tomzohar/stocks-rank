import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { HeaderNav } from "@/features/navigation/HeaderNav";
import { TabBar, TabBarView } from "@/features/navigation/TabBar";
import { AppVersion } from "@/features/pwa/AppVersion";
import { PwaControls } from "@/features/pwa/PwaControls";
import { UpdateNotice } from "@/features/pwa/UpdateNotice";
import { RadarGlyph } from "@/features/radar/RadarGlyph";
import { StockPicker } from "@/features/universe/StockPicker";
import { UNIVERSE_DATE } from "@/features/universe/universe";
import "@/styles/tokens.css";
import "@/styles/base.css";
import styles from "./layout.module.css";

// Self-hosted at build time, so the CSP's font-src 'self' still holds.
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "stocks-rank",
  description: "Score S&P 500 and Nasdaq-100 stocks on 13 metrics",
  applicationName: "stocks-rank",
  appleWebApp: { capable: true, title: "stocks-rank", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#070a10" },
  ],
  viewportFit: "cover",
};

/** The brand mark's shape: an irregular score profile, like the app icon. */
const MARK = [10, 7, 9, 5, 8, 10, 6, 9, 4, 8, 7, 10, 6];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <head>
        {/* With credentials: the site sits behind Vercel's login, and without
            the cookie the browser can't read the manifest to install the app. */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
      </head>
      <body>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/" className={styles.brand}>
              <RadarGlyph scores={MARK} size={26} />
              <span>
                stocks<span className={styles.brandDot}>·</span>rank
              </span>
            </Link>
            <StockPicker />
            <HeaderNav />
            <PwaControls />
          </div>
        </header>
        <main className={styles.main}>{children}</main>
        <footer className={styles.footer}>
          Market data from Yahoo Finance, delayed and unofficial. Index membership as of {UNIVERSE_DATE}. Not
          investment advice.
          <AppVersion />
        </footer>
        <Suspense fallback={<TabBarView pathname={null} />}>
          <TabBar />
        </Suspense>
        <UpdateNotice />
      </body>
    </html>
  );
}
