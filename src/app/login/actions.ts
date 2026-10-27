// Server actions for /login: Apple/Google OAuth, email one-time code, sign-out.
// Public (that is the point), so every input is validated and the answers are
// written not to reveal whether an email is known or invited.
// Server actions so the session cookie is set on the server.
"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { redeemRememberedInvite } from "@/lib/invites/cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "code_sent"; email: string }
  | { status: "error"; message: string; email?: string };

const emailSchema = z.email().max(254);

// Starts the redirect to the provider; the PKCE cookie is set on this origin,
// which is why /auth/callback must use the same site URL.
async function startOAuth(provider: "google" | "apple") {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error || !data.url) redirect("/login?error=1");
  redirect(data.url);
}

export async function signInWithGoogle() {
  await startOAuth("google");
}
export async function signInWithApple() {
  await startOAuth("apple");
}

// Responds identically for every well-formed address: the gate check and the
// mail send happen after the response, and errors are only logged, so neither
// the answer nor its timing reveals who is invited.
export async function requestCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse(
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success)
    return {
      status: "error",
      message: "Bitte gib eine gültige E-Mail-Adresse an.",
    };
  const email = parsed.data;

  const supabase = await createClient();
  after(async () => {
    try {
      const { data: allowed, error: gateError } = await createAdminClient().rpc(
        "can_request_login",
        {
          p_email: email,
        },
      );
      if (gateError) throw gateError;
      if (!allowed) return;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
    } catch (err) {
      console.error("login code request failed", err);
    }
  });
  return { status: "code_sent", email };
}

// Checks the 6-8 digit code from the email and, on success, signs the user in
// (the session cookie is set by Supabase) and claims a remembered invite.
export async function verifyCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\s/g, "");
  if (!emailSchema.safeParse(email).success || !/^\d{6,8}$/.test(token)) {
    return {
      status: "error",
      message: "Bitte gib den Code aus der E-Mail ein.",
      email,
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) {
    return {
      status: "error",
      message: "Der Code ist ungültig oder abgelaufen.",
      email,
    };
  }
  await redeemRememberedInvite(supabase);
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
