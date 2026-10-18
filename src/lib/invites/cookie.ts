import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeInviteCode } from "./code";

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
export async function redeemRememberedInvite(supabase: SupabaseClient) {
  const store = await cookies();
  const code = store.get(INVITE_COOKIE)?.value;
  if (!code) return;
  await supabase.rpc("redeem_invite", { code });
  store.delete(INVITE_COOKIE);
}
