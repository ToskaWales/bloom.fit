// /onboarding: entry point of the setup flow. Invited users only. It does not
// show anything; it redirects to the first unfinished step (see nextStep).
import { redirect } from "next/navigation";
import { requireInvited } from "@/lib/auth/dal";
import { nextStep } from "@/lib/onboarding/next-step";

// Resume where the user left off.
export default async function OnboardingIndex() {
  const { profile } = await requireInvited();
  const step = nextStep(profile);
  redirect(step ? `/onboarding/${step}` : "/app");
}
