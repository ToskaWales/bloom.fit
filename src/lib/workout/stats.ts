// Basic set maths: estimated 1RM, set volume and workout summary. Pure and
// shared by the workout screens, PR detection (./prs), the engine
// (@/lib/engine) and the importers. Rules for what counts as a working set live
// here in isWorking so every consumer agrees.
/** The minimum a set needs to be counted; local and server rows both fit this shape. */
export interface SetLike {
  set_type: string;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
  deleted_at: string | null;
}

// A working set: done, not deleted, not a warm-up.
const isWorking = (s: SetLike) =>
  s.completed && !s.deleted_at && s.set_type !== "warmup";

/**
 * Estimated one-rep max in kg (1 decimal) by the Epley formula: weight x (1 + reps / 30).
 * Returns null for missing values or more than 12 reps, where it is unreliable.
 */
export function estimateOneRepMax(
  weightKg: number | null,
  reps: number | null,
): number | null {
  if (weightKg == null || reps == null || reps < 1 || reps > 12) return null;
  return reps === 1
    ? weightKg
    : Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** Weight x reps in kg; 0 for warm-ups, unfinished, deleted or incomplete sets. */
export function setVolume(s: SetLike): number {
  if (!isWorking(s) || s.weight_kg == null || s.reps == null) return 0;
  return s.weight_kg * s.reps;
}

/** Number of working sets and their total volume (kg, 1 decimal). */
export function summarize(sets: SetLike[]): {
  workingSets: number;
  volumeKg: number;
} {
  return {
    workingSets: sets.filter(isWorking).length,
    volumeKg:
      Math.round(sets.reduce((sum, s) => sum + setVolume(s), 0) * 10) / 10,
  };
}
