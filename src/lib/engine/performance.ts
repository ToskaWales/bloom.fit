import type { DayValue } from "./patterns";
import type { ExerciseSession } from "./plateau";

const MIN_PRIOR_SESSIONS = 3;
const PRIOR_WINDOW = 8;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

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
