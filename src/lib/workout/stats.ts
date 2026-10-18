export interface SetLike {
  set_type: string;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
  deleted_at: string | null;
}

const isWorking = (s: SetLike) =>
  s.completed && !s.deleted_at && s.set_type !== "warmup";

// Epley formula; unreliable for high-rep sets, so those return null.
export function estimateOneRepMax(
  weightKg: number | null,
  reps: number | null,
): number | null {
  if (weightKg == null || reps == null || reps < 1 || reps > 12) return null;
  return reps === 1
    ? weightKg
    : Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function setVolume(s: SetLike): number {
  if (!isWorking(s) || s.weight_kg == null || s.reps == null) return 0;
  return s.weight_kg * s.reps;
}

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
