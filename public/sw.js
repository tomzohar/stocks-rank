// stocks-rank service worker: makes the app installable and usable offline.
//
// - Pages: network first; the last pages you opened are kept so they still
//   open offline (with their "as of" time), else an offline page is shown.
// - Build assets (/_next/static, /icons): cache first; their names are hashed.
// - Everything else, including /api/* and every other origin (notably
//   api.anthropic.com, which carries your API key), is left untouched.

const VERSION = "v2";
const STATIC_CACHE = `stocks-rank-static-${VERSION}`;
const PAGES_CACHE = `stocks-rank-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAX_PAGES = 50;
// Hashed build files from older deploys pile up; keep the newest ones.
const MAX_STATIC = 200;
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // One by one, so a single failure can't block installation.
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGES_CACHE]);
      for (const name of await caches.keys()) {
        if (name.startsWith("stocks-rank-") && !keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

/** Drops the oldest entries (cache keys come back in insertion order). */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const request of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(request);
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      caches
        .open(PAGES_CACHE)
        .then((cache) => cache.put(request, copy))
        .then(() => trim(PAGES_CACHE, MAX_PAGES))
        .catch(() => undefined);
    }
    return response;
  } catch {
    return (
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match(OFFLINE_URL)) ||
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const copy = response.clone();
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.put(request, copy))
      .then(() => trim(STATIC_CACHE, MAX_STATIC))
      .catch(() => undefined);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch other origins
  if (url.pathname.startsWith("/api/")) return; // live data only

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});
