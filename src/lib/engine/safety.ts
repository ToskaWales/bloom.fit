import { addDays, daysBetween } from "@/lib/daily/day";
import type { CycleSummary } from "@/lib/daily/cycle";
import { weightTrend, type WeightPoint } from "@/lib/daily/weight";

export interface SafetyInput {
  today: string;
  cycle: CycleSummary;
  checkins: { day: string; energy: number | null }[];
  /** null when the person hides weight: weight is then never used. */
  weights: WeightPoint[] | null;
  /** Food entries; null when nutrition is off: intake is then never used. */
  intake?: IntakeEntry[] | null;
}

export interface IntakeEntry {
  day: string;
  kcal: number | null;
}

export interface SafetyResult {
  active: boolean;
  overdueDays: number;
  lowEnergy: boolean;
  weightFall: boolean;
  lowIntake: boolean;
}

// Starting values, not clinical thresholds. The hint only asks her to talk to a
// doctor; it never diagnoses. It needs a clearly late period AND a second signal.
export const MIN_OVERDUE_DAYS = 7;
export const ENERGY_WINDOW_DAYS = 14;
export const MIN_ENERGY_VALUES = 7;
export const LOW_ENERGY_MEDIAN = 2;
export const WEIGHT_WINDOW_DAYS = 14;
export const MIN_WEIGHINS = 4;
export const WEIGHT_FALL = 0.02; // trend down by 2 % or more within two weeks
// Intake is only a signal when it was logged carefully: at least two entries on
// at least seven of the last 14 days, so a single "lunch" entry never counts.
// The level is an internal starting value, never shown, pending expert review.
export const INTAKE_WINDOW_DAYS = 14;
export const MIN_INTAKE_DAYS = 7;
export const MIN_ENTRIES_PER_DAY = 2;
export const LOW_INTAKE_KCAL = 1200;
export const ENERGY_NOTE_MIN_TRAINING_DAYS = 6; // about 3 a week, over two weeks

// Without a prediction window (irregular cycles, an old last start) a period
// counts as clearly late once it is a week past the longest ordinary cycle.
export const LONG_CYCLE_DAYS = 35;

export function lowIntake(
  today: string,
  intake: IntakeEntry[] | null | undefined,
): boolean {
  if (!intake) return false;
  const perDay = new Map<string, { kcal: number; entries: number }>();
  for (const e of intake) {
    if (
      e.kcal === null ||
      e.day > today ||
      daysBetween(e.day, today) >= INTAKE_WINDOW_DAYS
    )
      continue;
    const d = perDay.get(e.day) ?? { kcal: 0, entries: 0 };
    perDay.set(e.day, { kcal: d.kcal + e.kcal, entries: d.entries + 1 });
  }
  const logged = [...perDay.values()].filter(
    (d) => d.entries >= MIN_ENTRIES_PER_DAY,
  );
  return (
    logged.length >= MIN_INTAKE_DAYS &&
    median(logged.map((d) => d.kcal)) < LOW_INTAKE_KCAL
  );
}

function energyIsLow(
  today: string,
  checkins: { day: string; energy: number | null }[],
): boolean {
  const recent = checkins
    .filter(
      (c) =>
        c.energy !== null &&
        c.day <= today &&
        daysBetween(c.day, today) < ENERGY_WINDOW_DAYS,
    )
    .map((c) => c.energy as number);
  return (
    recent.length >= MIN_ENERGY_VALUES && median(recent) <= LOW_ENERGY_MEDIAN
  );
}

export interface EnergyNoteInput {
  today: string;
  checkins: { day: string; energy: number | null }[];
  intake: IntakeEntry[] | null;
  /** Days with a finished workout in the last 14 days. */
  trainingDays: number;
}

// For people without a period signal (pill, "no cycle"): careful intake logging
// that stays low, together with low energy and regular training.
export function evaluateEnergyNote({
  today,
  checkins,
  intake,
  trainingDays,
}: EnergyNoteInput) {
  const low = lowIntake(today, intake);
  const lowE = energyIsLow(today, checkins);
  return {
    active: low && lowE && trainingDays >= ENERGY_NOTE_MIN_TRAINING_DAYS,
    lowIntake: low,
    lowEnergy: lowE,
  };
}

function overdueFor(cycle: CycleSummary, today: string): number {
  if (cycle.status === "overdue" && cycle.overdueDays !== null)
    return cycle.overdueDays;
  if (
    cycle.lastStart &&
    (cycle.status === "irregular" ||
      cycle.status === "stale" ||
      cycle.status === "not_enough_data")
  )
    return Math.max(0, daysBetween(cycle.lastStart, today) - LONG_CYCLE_DAYS);
  return 0;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export function evaluateSafety({
  today,
  cycle,
  checkins,
  weights,
  intake,
}: SafetyInput): SafetyResult {
  const overdueDays = overdueFor(cycle, today);

  const recentEnergy = checkins
    .filter(
      (c) =>
        c.energy !== null &&
        c.day <= today &&
        daysBetween(c.day, today) < ENERGY_WINDOW_DAYS,
    )
    .map((c) => c.energy as number);
  const lowEnergy =
    recentEnergy.length >= MIN_ENERGY_VALUES &&
    median(recentEnergy) <= LOW_ENERGY_MEDIAN;

  let weightFall = false;
  if (weights) {
    const inMonth = weights.filter(
      (w) => w.day <= today && daysBetween(w.day, today) <= 28,
    );
    const trend = weightTrend(weights.filter((w) => w.day <= today));
    const now = trend.at(-1);
    const before = [...trend]
      .reverse()
      .find((p) => p.day <= addDays(today, -WEIGHT_WINDOW_DAYS));
    if (
      inMonth.length >= MIN_WEIGHINS &&
      now &&
      before &&
      daysBetween(now.day, today) <= 7 &&
      daysBetween(before.day, today) <= 21
    ) {
      weightFall = now.trend <= before.trend * (1 - WEIGHT_FALL);
    }
  }

  const lowIn = lowIntake(today, intake);
  const active =
    overdueDays >= MIN_OVERDUE_DAYS && (lowEnergy || weightFall || lowIn);
  return { active, overdueDays, lowEnergy, weightFall, lowIntake: lowIn };
}
