// Turns lifting history into one comparable "how did training go" number per day,
// used as the "performance" metric in ./patterns.ts and ./hunger.ts. Does not
// compute 1RM itself (that is @/lib/workout/stats) and does not judge the values.
import type { DayValue } from "./patterns";
import type { ExerciseSession } from "./plateau";
import { median } from "@/lib/math";

// A session needs at least 3 earlier sessions of the same exercise to have a
// baseline; the baseline looks at the 8 sessions before it.
const MIN_PRIOR_SESSIONS = 3;
const PRIOR_WINDOW = 8;

// Each session's best estimated 1RM relative to that exercise's own recent level
// (median of the previous sessions): +0.05 = 5 % above her usual, -0.1 = 10 %
// below. That makes exercises with different loads comparable. Sessions on the
// same day are averaged.
export function performanceSeries(
  exerciseSessions: Map<string, ExerciseSession[]>,
): DayValue[] {
  const byDay = new Map<string, number[]>();
  for (const sessions of exerciseSessions.values()) {
    const sorted = sessions
      .filter((s) => s.e1rm > 0)
      .sort((a, b) => a.day.localeCompare(b.day));
    for (let j = MIN_PRIOR_SESSIONS; j < sorted.length; j++) {
      const baseline = median(
        sorted.slice(Math.max(0, j - PRIOR_WINDOW), j).map((s) => s.e1rm),
      );
      byDay.set(sorted[j].day, [
        ...(byDay.get(sorted[j].day) ?? []),
        sorted[j].e1rm / baseline - 1,
      ]);
    }
  }
  return [...byDay].map(([day, v]) => ({
    day,
    value: v.reduce((a, b) => a + b, 0) / v.length,
  }));
}
