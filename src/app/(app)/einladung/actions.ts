// Server action for /einladung: redeem an invite code. Needs a signed-in user
// who has no access yet. The check itself is the database function
// redeem_invite (it verifies the hash, expiry and single use), so the code
// logic cannot be bypassed from the browser.
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
  // 19 = four groups of four characters plus three dashes; cheap check before the database call.
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
