import type { CycleContext, TrainingExperience, TrainingGoal } from '@/api/database.types';
import { addDays } from '@/engine/cyclePhase';
import { isIsoDate, todayIso } from './date';

export type OnboardingInput = {
  trainingGoal: TrainingGoal | null;
  trainingExperience: TrainingExperience | null;
  cycleContext: CycleContext | null;
  /** Eingabefeld als Text, damit leere/ungültige Eingaben prüfbar sind */
  cycleLength: string;
  /** Beginn der letzten Periode; leer = weiß ich nicht / nicht relevant */
  lastPeriodStart: string | null;
  consentHealthData: boolean;
  consentPrivacy: boolean;
};

export type OnboardingErrors = Partial<Record<keyof OnboardingInput, string>>;

export const CYCLE_LENGTH_RANGE = { min: 21, max: 45 } as const;
/** Ältere Perioden sind für die Vorhersage wertlos und meist ein Eingabefehler. */
export const MAX_LAST_PERIOD_AGE_DAYS = 365;

export const emptyOnboarding = (): OnboardingInput => ({
  trainingGoal: null,
  trainingExperience: null,
  cycleContext: null,
  cycleLength: '28',
  lastPeriodStart: null,
  consentHealthData: false,
  consentPrivacy: false,
});

/** Fehlerschlüssel sind stabile Codes; die Texte stehen in de.ts (onboarding.errors). */
export function validateOnboarding(
  input: OnboardingInput,
  today: string = todayIso(),
): OnboardingErrors {
  const errors: OnboardingErrors = {};

  if (!input.trainingGoal) errors.trainingGoal = 'required';
  if (!input.trainingExperience) errors.trainingExperience = 'required';
  if (!input.cycleContext) errors.cycleContext = 'required';

  const length = Number(input.cycleLength);
  if (
    !/^\d+$/.test(input.cycleLength.trim()) ||
    length < CYCLE_LENGTH_RANGE.min ||
    length > CYCLE_LENGTH_RANGE.max
  ) {
    errors.cycleLength = 'cycleLengthRange';
  }

  if (input.lastPeriodStart) {
    if (!isIsoDate(input.lastPeriodStart)) errors.lastPeriodStart = 'invalidDate';
    else if (input.lastPeriodStart > today) errors.lastPeriodStart = 'futureDate';
    else if (input.lastPeriodStart < addDays(today, -MAX_LAST_PERIOD_AGE_DAYS))
      errors.lastPeriodStart = 'tooOld';
  }

  if (!input.consentHealthData) errors.consentHealthData = 'required';
  if (!input.consentPrivacy) errors.consentPrivacy = 'required';

  return errors;
}

export const hasErrors = (errors: OnboardingErrors) => Object.keys(errors).length > 0;

/** Schritte des Onboardings und welche Felder dort geprüft werden. */
export const ONBOARDING_STEPS = ['intro', 'training', 'cycle', 'consent'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_FIELDS: Record<OnboardingStep, (keyof OnboardingInput)[]> = {
  intro: [],
  training: ['trainingGoal', 'trainingExperience'],
  cycle: ['cycleContext', 'cycleLength', 'lastPeriodStart'],
  consent: ['consentHealthData', 'consentPrivacy'],
};

export function errorsForStep(
  step: OnboardingStep,
  input: OnboardingInput,
  today?: string,
): OnboardingErrors {
  const all = validateOnboarding(input, today);
  const result: OnboardingErrors = {};
  for (const field of STEP_FIELDS[step]) if (all[field]) result[field] = all[field];
  return result;
}
