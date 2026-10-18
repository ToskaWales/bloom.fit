import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { redeemRememberedInvite } from "@/lib/invites/cookie";
import { createClient } from "@/lib/supabase/server";

// OAuth (Apple/Google) return target: exchange the PKCE code for a session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=1`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=1`);

  await redeemRememberedInvite(supabase);
  return NextResponse.redirect(
    `${origin}${safeNext(searchParams.get("next"))}`,
  );
}
