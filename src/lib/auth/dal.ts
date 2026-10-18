import "server-only";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export interface Profile {
  id: string;
  goals: string[];
  training_days: number | null;
  experience: string | null;
  units: "metric" | "imperial";
  cycle_mode: "natural" | "hormonal" | "irregular" | "none" | null;
  last_period_start: string | null;
  start_weight_kg: number | null;
  basics_completed_at: string | null;
  onboarding_completed_at: string | null;
  access_granted_at: string | null;
}

// Data access layer: every protected page and server action starts here.
// getUser() validates the token with the Auth server (unlike reading cookies).
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

async function loadProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  // A signed-in user without a profile is a server-side inconsistency, not a
  // reason to bounce them through /login (which would loop).
  if (error || !data) throw new Error("Profile not found for signed-in user");
  return data as Profile;
}

// Signed in, may not have access yet (used by /einladung).
export async function requireProfile() {
  const { supabase, user } = await requireUser();
  return { supabase, user, profile: await loadProfile(supabase, user.id) };
}

// Signed in and invited, onboarding may be unfinished (used by /onboarding).
export async function requireInvited() {
  const ctx = await requireProfile();
  if (!ctx.profile.access_granted_at) redirect("/einladung");
  return ctx;
}

// Fully set up (used by the app itself).
export async function requireOnboarded() {
  const ctx = await requireInvited();
  if (!ctx.profile.onboarding_completed_at) redirect("/onboarding");
  return ctx;
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  if (!user.email_confirmed_at || !isAdmin(user.email)) redirect("/");
  return { supabase, user };
}
