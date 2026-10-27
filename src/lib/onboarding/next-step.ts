// Decides which onboarding step a person still has to do, from her profile alone.
// Pure; the page for /onboarding redirects to it, the field rules are in ./schema.ts.
// German URL slugs of the steps (ziele = goals, zyklus = cycle, basis = basics, einwilligung = consent).
export type OnboardingStep = "ziele" | "zyklus" | "basis" | "einwilligung";

export const STEP_ORDER: readonly OnboardingStep[] = [
  "ziele",
  "zyklus",
  "basis",
  "einwilligung",
];

interface ProgressProfile {
  goals: string[];
  training_days: number | null;
  experience: string | null;
  cycle_mode: string | null;
  basics_completed_at: string | null;
  onboarding_completed_at: string | null;
}

// First incomplete step, or null when onboarding is done.
export function nextStep(p: ProgressProfile): OnboardingStep | null {
  if (p.onboarding_completed_at) return null;
  if (p.goals.length === 0 || p.training_days == null || p.experience == null)
    return "ziele";
  if (!p.cycle_mode) return "zyklus";
  if (!p.basics_completed_at) return "basis";
  return "einwilligung";
}
