// Which build of the app this page is running, and how to tell if a newer one
// is live. The id is fixed at build time (see next.config.ts), so the page's
// copy and the server's copy differ exactly when a new deploy has gone out.

export const BUILD_ID: string = process.env.STOCKS_RANK_BUILD_ID ?? "dev";

/** Reads `{ build }` from /api/version; anything else (offline, a login page) counts as unknown. */
export function parseVersion(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const build = (body as { build?: unknown }).build;
  return typeof build === "string" && build.length > 0 ? build : null;
}

export function isNewBuild(current: string, live: string | null): boolean {
  return live !== null && live !== current;
}

export async function fetchLiveBuild(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return null;
    return parseVersion(await res.json());
  } catch {
    return null;
  }
}
