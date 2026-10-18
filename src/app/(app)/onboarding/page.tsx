import { redirect } from "next/navigation";
import { requireInvited } from "@/lib/auth/dal";

// Resume where the user left off.
export default async function OnboardingIndex() {
  const { profile } = await requireInvited();
  if (profile.onboarding_completed_at) redirect("/app");
  if (profile.goals.length === 0) redirect("/onboarding/ziele");
  if (!profile.cycle_mode) redirect("/onboarding/zyklus");
  redirect("/onboarding/basis");
}
