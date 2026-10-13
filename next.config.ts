import { execSync } from "node:child_process";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * One id per deploy, baked into both the pages and /api/version, so an open
 * window can tell when a newer deploy is live and offer a reload. Vercel
 * provides it; local builds fall back to the git commit.
 */
function buildId(): string {
  const fromHost = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromHost) return fromHost;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}
const BUILD_ID = buildId();

// The page holds the viewer's Claude API key, so it may only talk to itself
// and api.anthropic.com: an injected script couldn't send the key anywhere
// else. Inline scripts are needed by Next's streaming without nonces.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.anthropic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Lets Next.js itself notice a new deploy on client-side navigation and do a full reload.
  deploymentId: BUILD_ID,
  env: { STOCKS_RANK_BUILD_ID: BUILD_ID },
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // Browsers must always re-check the service worker so updates roll out.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
