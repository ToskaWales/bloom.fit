"use server";

import { redirect } from "next/navigation";
import type { StepState } from "@/components/step-form";
import { requireProfile } from "@/lib/auth/dal";
import { normalizeInviteCode } from "@/lib/invites/code";

export async function redeemCode(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const { supabase } = await requireProfile();
  const code = normalizeInviteCode(String(formData.get("code") ?? ""));
  if (code.length < 19)
    return {
      error: "Bitte gib deinen Einladungscode ein (z. B. ABCD-EFGH-JKLM-NPQR).",
    };
  const { data, error } = await supabase.rpc("redeem_invite", { code });
  if (error || data !== true)
    return {
      error: "Der Code ist ungültig, abgelaufen oder wurde schon verwendet.",
    };
  redirect("/onboarding");
}
