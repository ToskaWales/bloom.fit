import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Response headers for every route (see each entry below).
  async headers() {
    return [
      {
        // The camera is only for the barcode scanner, on our own pages.
        // Microphone and location are never needed, so they are switched off
        // for the whole site (and for any embedded third-party frame).
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // The service worker must always be revalidated so updates roll out.
        // If browsers cached sw.js, devices could stay on an old offline shell
        // (and old sync code) for days.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
  // cacheComponents: pages are prerendered as a static shell; anything that
  // reads the session or request data must sit behind <Suspense> and streams in.
  cacheComponents: true,
  // Prefetch only the static part of a route, so links stay cheap while the
  // personal (dynamic) parts are fetched on navigation.
  partialPrefetching: true,
  // Tailwind v4 is run through its Turbopack loader for every stylesheet.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
