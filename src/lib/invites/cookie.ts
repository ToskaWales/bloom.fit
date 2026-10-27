// Invite redemption across the login. Opening an invite link (src/app/einladen/route.ts)
// stores the code in a short-lived HttpOnly cookie; after the person signed in, the
// code is redeemed through the database function redeem_invite, which grants access
// once. Code format is ./code.ts.
import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeInviteCode } from "./code";

// Lives one hour; long enough to finish a login, short enough not to linger.
export const INVITE_COOKIE = "bloom_invite";

export async function rememberInvite(code: string) {
  (await cookies()).set(INVITE_COOKIE, normalizeInviteCode(code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });
}

// After a successful login: redeem the code remembered from the invite link, if any.
// The result of redeem_invite is deliberately ignored and the cookie always cleared:
// a wrong, used or expired code simply leaves her on the /einladung page.
export async function redeemRememberedInvite(supabase: SupabaseClient) {
  const store = await cookies();
  const code = store.get(INVITE_COOKIE)?.value;
  if (!code) return;
  await supabase.rpc("redeem_invite", { code });
  store.delete(INVITE_COOKIE);
}
