import { redirect } from "next/navigation";
import { requireInvited } from "@/lib/auth/dal";
import { nextStep } from "@/lib/onboarding/next-step";

// Resume where the user left off.
export default async function OnboardingIndex() {
  const { profile } = await requireInvited();
  const step = nextStep(profile);
  redirect(step ? `/onboarding/${step}` : "/app");
}
