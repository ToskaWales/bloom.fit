// Next.js request proxy (the former "middleware"): runs before every page request.
// It only keeps the Supabase session fresh and bounces signed-out visitors away
// from app pages. Authorization does NOT live here; every page and server action
// re-checks in src/lib/auth/dal.ts. Cookie flags come from src/lib/supabase/cookie-options.ts.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hardenCookie } from "@/lib/supabase/cookie-options";

// Refreshes the Supabase session cookie on every request and does an
// optimistic redirect for signed-out visitors. Real authorization happens in
// the data access layer (src/lib/auth/dal.ts), never only here.
// A path is protected if it equals one of these or lives below it.
const PROTECTED = [
  "/app",
  "/training",
  "/onboarding",
  "/einstellungen",
  "/einladung",
  "/admin",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, hardenCookie(options)),
          );
        },
      },
    },
  );

  // getClaims() validates the session token without asking the Auth server on every
  // request, which is fine for an optimistic redirect; dal.ts uses getUser() for real checks.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (
    !signedIn &&
    PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Carry over any cookies the refresh just set, so the redirect does not lose them.
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

// Skip static assets and images: they need no session and must stay fast.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
