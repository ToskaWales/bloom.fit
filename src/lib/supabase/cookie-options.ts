// Single place that decides the flags of auth cookies. Used by ./server.ts and src/proxy.ts so both set the same hardened cookies.
import type { CookieOptions } from "@supabase/ssr";

// The app never uses a browser Supabase client, so auth cookies can be
// HttpOnly: an XSS bug can't read the refresh token of a health-data account.
// Forces HttpOnly, SameSite=Lax and (in production) Secure on top of Supabase's defaults.
export function hardenCookie(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
