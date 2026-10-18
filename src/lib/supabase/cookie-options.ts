import type { CookieOptions } from "@supabase/ssr";

// The app never uses a browser Supabase client, so auth cookies can be
// HttpOnly: an XSS bug can't read the refresh token of a health-data account.
export function hardenCookie(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
