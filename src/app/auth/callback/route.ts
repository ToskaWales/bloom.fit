// GET /auth/callback: return target of the Apple/Google sign-in. Public by
// necessity (the visitor is not signed in yet); it only acts on a valid
// one-time `code` that Supabase exchanges for a session cookie. The `next`
// redirect goes through safeNext() so it can never point to another site.
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { redeemRememberedInvite } from "@/lib/invites/cookie";
import { createClient } from "@/lib/supabase/server";

// OAuth (Apple/Google) return target: exchange the PKCE code for a session.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Same origin the OAuth flow was started from (PKCE cookie lives there);
  // the env var wins so the redirect never lands on an internal host name.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=1`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=1`);

  // If the visitor came through an invite link, claim it now that they have a session.
  await redeemRememberedInvite(supabase);
  return NextResponse.redirect(
    `${origin}${safeNext(searchParams.get("next"))}`,
  );
}
