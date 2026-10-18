"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { redeemRememberedInvite } from "@/lib/invites/cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "code_sent"; email: string }
  | { status: "error"; message: string; email?: string };

const emailSchema = z.email().max(254);

export async function signInWithProvider(provider: "google" | "apple") {
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
  await signInWithProvider("google");
}
export async function signInWithApple() {
  await signInWithProvider("apple");
}

// Always answers "code sent" so the form can't be used to find out who is invited.
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

  try {
    const { data: allowed } = await createAdminClient().rpc(
      "can_request_login",
      { p_email: email },
    );
    if (allowed) {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
    }
  } catch (err) {
    console.error("login code request failed", err);
    return {
      status: "error",
      message:
        "Das hat leider nicht geklappt. Bitte versuche es später noch einmal.",
    };
  }
  return { status: "code_sent", email };
}

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
