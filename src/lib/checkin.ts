export type CheckinInput = {
  sleepHours: number;
  motivation: number | null;
  energy: number | null;
};
export type CheckinErrors = Partial<Record<keyof CheckinInput, 'required' | 'range'>>;

export const SLEEP = { min: 0, max: 14, step: 0.5, default: 7 } as const;

/** Schlaf in 0,5-Schritten verändern und auf den zulässigen Bereich begrenzen. */
export function stepSleep(current: number, direction: 1 | -1): number {
  const next = current + direction * SLEEP.step;
  return Math.min(SLEEP.max, Math.max(SLEEP.min, Math.round(next * 2) / 2));
}

export function validateCheckin(input: CheckinInput): CheckinErrors {
  const errors: CheckinErrors = {};
  if (!Number.isFinite(input.sleepHours) || input.sleepHours < 0 || input.sleepHours > 24) {
    errors.sleepHours = 'range';
  }
  for (const field of ['motivation', 'energy'] as const) {
    const value = input[field];
    if (value === null) errors[field] = 'required';
    else if (!Number.isInteger(value) || value < 1 || value > 5) errors[field] = 'range';
  }
  return errors;
}
