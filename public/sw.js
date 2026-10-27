/*
 * Bloom service worker: lets the training log open and work offline. It caches
 * only what is needed to START the app without network; the data itself lives in
 * IndexedDB (src/lib/local) and is synced by src/lib/sync, not by this file.
 *
 * Caching rules
 *  1. /_next/static/* (and the barcode scanner's WebAssembly file): cache-first.
 *     These files are content-hashed and never change, so a cached copy is always right.
 *     The .wasm is not hashed; bumping VERSION below replaces it.
 *  2. An explicit allowlist of app pages (CACHEABLE_PATHS): network-first. If the
 *     network answers within NETWORK_TIMEOUT_MS the fresh page is used and cached;
 *     otherwise the last cached copy is shown. An uncached /training/session falls back to the cached /training page.
 *  3. Everything else (settings, admin, data export, API, auth, other origins,
 *     non-GET) is never touched or cached, because it contains personal data
 *     or must always be live.
 *
 * Safety: only plain successful HTML is stored (storable); a redirect to /login
 * means the session ended, so ALL cached pages are dropped. An optional "clear-pages" message (not sent by the app today; logout calls clearPageCache itself)
 * does the same on request (on logout the app also deletes the caches directly,
 * see clearPageCache in src/lib/local/wipe.ts).
 * Changing VERSION makes the old caches disappear on activate.
 */
const VERSION = "v4";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const NETWORK_TIMEOUT_MS = 3000;
// Pages that may be cached. Exact paths (no prefix match), so e.g. /training/session
// is allowed but /training/anything-else is not.
const CACHEABLE_PATHS = [
  "/app",
  "/training",
  "/training/session",
  "/verlauf",
  "/zyklus",
  "/muster",
  "/ernaehrung",
];
// Shown instead of an uncached /training/* page when the network is offline or slower than the timeout.
const OFFLINE_FALLBACK = "/training";

// Take over immediately instead of waiting for all tabs to close, so a fixed
// worker reaches users quickly.
self.addEventListener("install", () => self.skipWaiting());

// Delete caches of older versions, then control already-open pages.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES]);
      for (const key of await caches.keys())
        if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// Messages from the page: "clear-pages" (optional, currently unused) and {type:"warm", paths} (prefetch).
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
  // The page asks us to fetch a route and the assets it needs, so it opens offline.
  if (event.data && event.data.type === "warm")
    event.waitUntil(warm(event.data.paths || []));
});

// /training/session?id=… is a client-rendered shell: one cached copy serves every id.
function pageKey(url) {
  const u = new URL(url);
  if (u.pathname === "/training/session") u.search = "";
  return u.origin + u.pathname + u.search;
}

const isCacheablePage = (url) =>
  CACHEABLE_PATHS.includes(new URL(url).pathname);

const isHtmlRequest = (request) =>
  request.mode === "navigate" ||
  (request.headers.get("accept") || "").includes("text/html");

// Only plain, successful HTML pages. Downloads (Content-Disposition), redirects
// (e.g. to /login) and anything else are never stored.
function storable(response) {
  if (!response.ok || response.redirected) return false;
  if (response.headers.get("content-disposition")) return false;
  return (response.headers.get("content-type") || "").includes("text/html");
}

// Prefetches the hashed JS/CSS a cached page refers to, so the page really works
// offline and not just its HTML.
async function cacheAssetsOf(html) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g))
    urls.add(m[1]);
  const cache = await caches.open(STATIC);
  await Promise.all(
    [...urls].map(async (u) => {
      if (await cache.match(u)) return;
      try {
        const res = await fetch(u);
        if (res.ok) await cache.put(u, res);
      } catch {
        // best effort
      }
    }),
  );
}

// Fetches allowlisted pages ahead of time (called while online, signed in).
// Ignores paths that are not allowlisted, offline errors and redirects.
async function warm(paths) {
  const cache = await caches.open(PAGES);
  for (const path of paths) {
    if (!CACHEABLE_PATHS.includes(path)) continue;
    try {
      const res = await fetch(path, { headers: { Accept: "text/html" } });
      if (!storable(res)) continue;
      const copy = res.clone();
      await cache.put(pageKey(self.location.origin + path), res);
      await cacheAssetsOf(await copy.text());
    } catch {
      // offline or signed out: nothing to warm
    }
  }
}

// Network with a time limit, cache as fallback. A slow response is not cancelled:
// it still updates the cache for next time.
async function networkFirst(event) {
  const { request } = event;
  const cache = await caches.open(PAGES);
  const key = pageKey(request.url);

  const network = fetch(request).then(async (response) => {
    if (response.redirected && new URL(response.url).pathname === "/login") {
      // Signed out: stop serving personalised pages from the cache.
      await caches.delete(PAGES);
    } else if (storable(response)) {
      await cache.put(key, response.clone());
    }
    return response;
  });
  // A slow network keeps running in the background and still refreshes the cache.
  event.waitUntil(network.catch(() => {}));

  try {
    return await Promise.race([
      network,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS),
      ),
    ]);
  } catch {
    const cached = await cache.match(key);
    if (cached) return cached;
    const path = new URL(request.url).pathname;
    if (path.startsWith("/training")) {
      const fallback = await cache.match(
        pageKey(self.location.origin + OFFLINE_FALLBACK),
      );
      if (fallback) return fallback;
    }
    return new Response(
      "Du bist offline und diese Seite wurde noch nicht geladen.",
      {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
}

// Cached copy if present, otherwise fetch once and keep it.
async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The barcode scanner's WebAssembly file (about 1 MB): kept after first use so the
  // scanner also starts offline. It is not content-hashed, so a new VERSION above
  // replaces it when the library is upgraded.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/vendor/zxing_reader.wasm"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (isHtmlRequest(request) && isCacheablePage(request.url))
    event.respondWith(networkFirst(event));
});
