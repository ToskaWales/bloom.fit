// Bloom service worker: lets the app open and work offline.
// - /_next/static assets: cache-first (content-hashed, immutable)
// - pages: network-first, falling back to the last cached copy
// - API / auth / non-GET requests are never cached
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

// /training/session?id=… is a client-rendered shell: one cached copy serves every id.
function pageKey(url) {
  const u = new URL(url);
  if (u.pathname === "/training/session") u.search = "";
  return u.origin + u.pathname + u.search;
}

const isHtmlRequest = (request) =>
  request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  const key = pageKey(request.url);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)),
    ]);
    // Don't cache redirects (e.g. to /login) or errors.
    if (response.ok && !response.redirected) cache.put(key, response.clone());
    return response;
  } catch {
    const cached = await cache.match(key);
    if (cached) return cached;
    return (
      (await cache.match(pageKey(self.location.origin + "/training"))) ||
      new Response("Du bist offline und diese Seite wurde noch nicht geladen.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (isHtmlRequest(request)) event.respondWith(networkFirst(request));
});
