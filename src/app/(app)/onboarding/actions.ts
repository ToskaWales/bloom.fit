"use server";

import { redirect } from "next/navigation";
import type { StepState } from "@/components/step-form";
import { requireInvited } from "@/lib/auth/dal";
import {
  basicsStep,
  CONSENT_VERSIONS,
  consentStep,
  cycleStep,
  goalsStep,
} from "@/lib/onboarding/schema";

export async function saveGoals(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const { supabase, user } = await requireInvited();
  const parsed = goalsStep.safeParse({
    goals: formData.getAll("goals"),
    trainingDays: formData.get("trainingDays"),
    experience: formData.get("experience"),
  });
  if (!parsed.success)
    return {
      error:
        "Wähle mindestens ein Ziel und ergänze Trainingstage und Erfahrung.",
    };
  const { error } = await supabase
    .from("profiles")
    .update({
      goals: parsed.data.goals,
      training_days: parsed.data.trainingDays,
      experience: parsed.data.experience,
    })
    .eq("id", user.id);
  if (error)
    return {
      error: "Speichern hat nicht geklappt. Bitte versuche es noch einmal.",
    };
  redirect("/onboarding/zyklus");
}

export async function saveCycle(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const { supabase, user } = await requireInvited();
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
  if (error)
    return {
      error: "Speichern hat nicht geklappt. Bitte versuche es noch einmal.",
    };
  redirect("/onboarding/basis");
}

export async function saveBasics(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const { supabase, user } = await requireInvited();
  const parsed = basicsStep.safeParse({
    units: formData.get("units"),
    startWeight: String(formData.get("startWeight") ?? ""),
  });
  if (!parsed.success)
    return {
      error: "Bitte gib ein plausibles Gewicht an oder lass das Feld leer.",
    };
  const { error } = await supabase
    .from("profiles")
    .update({
      units: parsed.data.units,
      start_weight_kg: parsed.data.startWeightKg,
    })
    .eq("id", user.id);
  if (error)
    return {
      error: "Speichern hat nicht geklappt. Bitte versuche es noch einmal.",
    };
  redirect("/onboarding/einwilligung");
}

export async function saveConsents(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const { supabase, user } = await requireInvited();
  const parsed = consentStep.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error:
        "Ohne Nutzungsbedingungen und die Einwilligung zu Gesundheitsdaten kann Bloom nicht funktionieren.",
    };
  }
  const wanted = [
    "terms" as const,
    "health_data" as const,
    ...(parsed.data.productMail ? (["product_mail"] as const) : []),
  ];
  const { data: active, error: readError } = await supabase
    .from("consents")
    .select("kind")
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if (readError)
    return {
      error: "Speichern hat nicht geklappt. Bitte versuche es noch einmal.",
    };
  const have = new Set((active ?? []).map((c) => c.kind));
  const missing = wanted.filter((k) => !have.has(k));
  if (missing.length) {
    const { error } = await supabase.from("consents").insert(
      missing.map((kind) => ({
        user_id: user.id,
        kind,
        version: CONSENT_VERSIONS[kind],
      })),
    );
    if (error)
      return {
        error: "Speichern hat nicht geklappt. Bitte versuche es noch einmal.",
      };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    return {
      error: /profile incomplete/.test(error.message)
        ? "Bitte schließe zuerst alle vorherigen Schritte ab."
        : "Speichern hat nicht geklappt. Bitte versuche es noch einmal.",
    };
  }
  redirect("/app");
}
