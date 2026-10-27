// Safety rule: a clearly late period plus a second signal (low energy, falling
// weight trend, low logged intake) shows a notice that only suggests talking to a
// professional; it never diagnoses. Also holds the variant for people without a
// period signal. Cycle status comes from @/lib/daily/cycle; ./index.ts turns the
// result into a hint and then never suggests doing more. Wording is in ./texts.ts.
import { addDays, daysBetween } from "@/lib/daily/day";
import type { CycleSummary } from "@/lib/daily/cycle";
import { weightTrend, type WeightPoint } from "@/lib/daily/weight";
import { median } from "@/lib/math";

/** Inputs for evaluateSafety. Hidden data (weight, intake) arrives as null and is then never used. */
export interface SafetyInput {
  today: string;
  cycle: CycleSummary;
  checkins: { day: string; energy: number | null }[];
  /** null when the person hides weight: weight is then never used. */
  weights: WeightPoint[] | null;
  /** Food entries; null when nutrition is off: intake is then never used. */
  intake?: IntakeEntry[] | null;
}

/** One logged food entry (kcal null when unknown). */
export interface IntakeEntry {
  day: string;
  kcal: number | null;
}

/** active = show the notice; the other fields say which signals were present (shown as reasons). */
export interface SafetyResult {
  active: boolean;
  overdueDays: number;
  lowEnergy: boolean;
  weightFall: boolean;
  lowIntake: boolean;
}

// Starting values, not clinical thresholds. The hint only asks her to talk to a
// doctor; it never diagnoses. It needs a clearly late period AND a second signal.
export const MIN_OVERDUE_DAYS = 7; // days past the expected start
export const ENERGY_WINDOW_DAYS = 14;
export const MIN_ENERGY_VALUES = 7;
export const LOW_ENERGY_MEDIAN = 2; // median energy of 1 or 2 on the 1-5 scale
export const WEIGHT_WINDOW_DAYS = 14;
export const MIN_WEIGHINS = 4;
export const WEIGHT_FALL = 0.02; // trend down by 2 % or more within two weeks
// Intake is only a signal when it was logged carefully: at least two entries on
// at least seven of the last 14 days, so a single "lunch" entry never counts.
// The level is an internal starting value, never shown, pending expert review.
export const INTAKE_WINDOW_DAYS = 14;
export const MIN_INTAKE_DAYS = 7;
export const MIN_ENTRIES_PER_DAY = 2;
export const LOW_INTAKE_KCAL = 1200; // median logged kcal per day, only on carefully logged days
export const ENERGY_NOTE_MIN_TRAINING_DAYS = 6; // about 3 a week, over two weeks

// Without a prediction window (irregular cycles, an old last start) a period
// counts as clearly late once it is a week past the longest ordinary cycle.
export const LONG_CYCLE_DAYS = 35;

/**
 * True when carefully logged days (>= 2 entries on >= 7 of the last 14) have a
 * median below LOW_INTAKE_KCAL. False when nutrition is off (null/undefined).
 * Never shown as a number to her: only feeds the safety notice.
 */
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

// Median energy of the last 14 days is 1-2, with at least 7 answers.
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

/** Inputs for evaluateEnergyNote. */
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

// How many days the period is late. Without a usable prediction (irregular,
// stale, too little data) it counts days beyond the longest ordinary cycle.
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

/**
 * Decides whether the safety notice is active: overdue >= MIN_OVERDUE_DAYS AND
 * at least one of low energy, falling weight trend, low intake. One signal alone
 * (or a late period alone) never triggers it. The weight check uses the smoothed
 * trend over 14 days and needs recent weigh-ins so an old fall does not linger.
 */
export function evaluateSafety({
  today,
  cycle,
  checkins,
  weights,
  intake,
}: SafetyInput): SafetyResult {
  const overdueDays = overdueFor(cycle, today);

  const lowEnergy = energyIsLow(today, checkins);

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
