"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { StepState } from "@/components/step-form";
import { requireOnboarded, requireUser } from "@/lib/auth/dal";
import { CONSENT_VERSIONS, cycleStep } from "@/lib/onboarding/schema";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateCycle(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const { supabase, user } = await requireOnboarded();
  const parsed = cycleStep(new Date()).safeParse({
    cycleMode: formData.get("cycleMode"),
    lastPeriodStart: String(formData.get("lastPeriodStart") ?? "") || undefined,
  });
  if (!parsed.success)
    return {
      error:
        "Bitte wähle eine Option und prüfe das Datum (nicht in der Zukunft).",
    };
  const { error } = await supabase
    .from("profiles")
    .update({
      cycle_mode: parsed.data.cycleMode,
      last_period_start: parsed.data.lastPeriodStart,
    })
    .eq("id", user.id);
  if (error) return { error: "Speichern hat nicht geklappt." };
  revalidatePath("/einstellungen");
  return {};
}

export async function setProductMail(formData: FormData) {
  const { supabase, user } = await requireOnboarded();
  const wanted = formData.get("productMail") === "on";
  const { data: active, error: readError } = await supabase
    .from("consents")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "product_mail")
    .is("revoked_at", null);
  if (readError) throw readError;

  if (wanted && !active?.length) {
    const { error } = await supabase.from("consents").insert({
      user_id: user.id,
      kind: "product_mail",
      version: CONSENT_VERSIONS.product_mail,
    });
    if (error) throw error;
  } else if (!wanted && active?.length) {
    const { error } = await supabase
      .from("consents")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("kind", "product_mail")
      .is("revoked_at", null);
    if (error) throw error;
  }
  revalidatePath("/einstellungen");
}

export async function deleteAccount(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const { supabase, user } = await requireUser();
  if (
    String(formData.get("confirm") ?? "")
      .trim()
      .toUpperCase() !== "LÖSCHEN"
  ) {
    return { error: "Bitte tippe zur Bestätigung LÖSCHEN." };
  }
  // Remove personal data that isn't linked by a cascading foreign key.
  const admin = createAdminClient();
  if (user.email) {
    const email = user.email.toLowerCase();
    const cleanup = await Promise.all([
      admin.from("waitlist").delete().eq("email", email),
      admin.from("invites").delete().eq("email", email),
      admin.from("invites").delete().eq("redeemed_by", user.id),
    ]);
    if (cleanup.some((r) => r.error))
      return {
        error:
          "Das Löschen hat nicht geklappt. Bitte versuche es später noch einmal.",
      };
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error)
    return {
      error:
        "Das Löschen hat nicht geklappt. Bitte versuche es später noch einmal.",
    };
  await supabase.auth.signOut();
  redirect("/");
}
