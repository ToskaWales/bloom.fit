import { addDays, daysBetween } from "@/lib/daily/day";
import type { CycleSummary } from "@/lib/daily/cycle";
import { weightTrend, type WeightPoint } from "@/lib/daily/weight";

export interface SafetyInput {
  today: string;
  cycle: CycleSummary;
  checkins: { day: string; energy: number | null }[];
  /** null when the person hides weight: weight is then never used. */
  weights: WeightPoint[] | null;
}

export interface SafetyResult {
  active: boolean;
  overdueDays: number;
  lowEnergy: boolean;
  weightFall: boolean;
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
}: SafetyInput): SafetyResult {
  const overdueDays =
    cycle.status === "overdue" && cycle.overdueDays !== null
      ? cycle.overdueDays
      : 0;

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
      daysBetween(now.day, today) <= 7
    ) {
      weightFall = now.trend <= before.trend * (1 - WEIGHT_FALL);
    }
  }

  const active = overdueDays >= MIN_OVERDUE_DAYS && (lowEnergy || weightFall);
  return { active, overdueDays, lowEnergy, weightFall };
}
