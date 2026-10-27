// Detects a rise in her own hunger ratings (last 7 days vs. the 4 weeks before).
// Pure function over check-ins; weight and logged food are deliberately NOT used,
// and it never produces a calorie number. The result feeds the "hunger_note"
// candidate built in ./index.ts; wording lives in ./texts.ts.
import { daysBetween } from "@/lib/daily/day";
import type { DayValue } from "./patterns";
import { median, round1 } from "@/lib/math";

/** Inputs for detectHungerRise; `checkins` may contain null hunger (not logged). */
export interface HungerInput {
  today: string;
  checkins: { day: string; hunger: number | null }[];
  /** Days with a finished workout in the last 14 days. */
  trainingDays: number;
  /** Relative training performance per day (see performance.ts). */
  performance?: DayValue[];
}

/** What the hint shows: medians on the 1-5 scale, plus training context. */
export interface HungerRise {
  recent: number;
  before: number;
  trainingDays: number;
  /** Whole percent below her usual level over the last two weeks, or null. */
  perfDrop: number | null;
}

// Starting values, not proven limits: hunger over the last seven days compared
// with her own four weeks before, and only for people who train regularly.
export const RECENT_DAYS = 7;
export const BEFORE_DAYS = 35;
export const MIN_RECENT_VALUES = 4;
export const MIN_BEFORE_VALUES = 10;
export const MIN_RISE = 1; // points on the 1-5 scale
export const MIN_TRAINING_DAYS = 4;
export const PERF_WINDOW_DAYS = 14;
export const MIN_PERF_DROP = 0.04;
export const MIN_PERF_DAYS = 2; // one bad session is not a trend

// Returns a HungerRise when the median hunger of the last 7 days is at least 1
// point above her own median of the 28 days before, else null. Needs enough
// values in both periods and regular training (4+ days in 14).
// A signal to notice, never a judgement. perfDrop is only set on a clear dip.
export function detectHungerRise({
  today,
  checkins,
  trainingDays,
  performance = [],
}: HungerInput): HungerRise | null {
  if (trainingDays < MIN_TRAINING_DAYS) return null;
  const known = checkins.filter(
    (c): c is { day: string; hunger: number } =>
      c.hunger !== null && c.day <= today,
  );
  const recent = known
    .filter((c) => daysBetween(c.day, today) < RECENT_DAYS)
    .map((c) => c.hunger);
  const before = known
    .filter((c) => {
      const age = daysBetween(c.day, today);
      return age >= RECENT_DAYS && age < BEFORE_DAYS;
    })
    .map((c) => c.hunger);
  if (recent.length < MIN_RECENT_VALUES || before.length < MIN_BEFORE_VALUES)
    return null;

  const recentMedian = median(recent);
  const beforeMedian = median(before);
  if (recentMedian - beforeMedian < MIN_RISE) return null;

  const lately = performance.filter(
    (p) => p.day <= today && daysBetween(p.day, today) < PERF_WINDOW_DAYS,
  );
  const avg = lately.length
    ? lately.reduce((s, p) => s + p.value, 0) / lately.length
    : 0;
  return {
    recent: round1(recentMedian),
    before: round1(beforeMedian),
    trainingDays,
    perfDrop:
      lately.length >= MIN_PERF_DAYS && avg <= -MIN_PERF_DROP
        ? Math.round(-avg * 100)
        : null,
  };
}
