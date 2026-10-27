// Detects a stalled exercise from its estimated-1RM history. Pure function; the
// wording ("Stagnation gehoert dazu") lives in ./texts.ts and the cooldown in
// ./select.ts. Per-session e1rm values come from @/lib/workout/stats.
import { daysBetween } from "@/lib/daily/day";

/** One workout day for one exercise. */
export interface ExerciseSession {
  day: string;
  /** Best estimated one-rep max of that session (kg). */
  e1rm: number;
}

/** What the hint shows: recent block vs. the weeks before (e1rm in kg). */
export interface Plateau {
  sessions: number;
  weeks: number;
  recentBest: number;
  earlierBest: number;
}

// Starting values, not proven limits: 4 sessions within 8 weeks, compared with
// at least 2 sessions from the 12 weeks before.
export const PLATEAU_SESSIONS = 4;
export const PLATEAU_WINDOW_DAYS = 56;
export const MIN_EARLIER_SESSIONS = 2;
export const MIN_GAIN = 0.01; // under 1 % better than the weeks before = no progress
export const EARLIER_WINDOW_DAYS = 84; // the twelve weeks before the recent block, not an old record

// Returns a Plateau when the 4 most recent sessions (the first within 8 weeks of
// today) are not at least 1 % better than the best of the weeks before them,
// otherwise null. A decline counts as a plateau too.
export function detectPlateau(
  sessions: ExerciseSession[],
  today: string,
): Plateau | null {
  const sorted = [...sessions]
    .filter((x) => x.e1rm > 0)
    .sort((a, b) => a.day.localeCompare(b.day));
  if (sorted.length < PLATEAU_SESSIONS + MIN_EARLIER_SESSIONS) return null;

  const recent = sorted.slice(-PLATEAU_SESSIONS);
  if (daysBetween(recent[0].day, today) > PLATEAU_WINDOW_DAYS) return null;
  // Compare with the weeks right before the recent block. After a break, an
  // illness or a heavy single from long ago, an old record must not count.
  const earlier = sorted
    .slice(0, -PLATEAU_SESSIONS)
    .filter((x) => daysBetween(x.day, recent[0].day) <= EARLIER_WINDOW_DAYS);
  if (earlier.length < MIN_EARLIER_SESSIONS) return null;

  const recentBest = Math.max(...recent.map((s) => s.e1rm));
  const earlierBest = Math.max(...earlier.map((s) => s.e1rm));
  if (recentBest > earlierBest * (1 + MIN_GAIN)) return null;

  const span = daysBetween(recent[0].day, recent[PLATEAU_SESSIONS - 1].day);
  return {
    sessions: PLATEAU_SESSIONS,
    weeks: Math.max(1, Math.ceil((span + 1) / 7)),
    recentBest,
    earlierBest,
  };
}
