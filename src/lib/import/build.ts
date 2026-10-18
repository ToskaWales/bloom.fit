import { matchExercise, normalizeName } from "@/lib/exercises/match";
import type { LocalDb } from "@/lib/local/db";
import { saveRows } from "@/lib/local/repo";
import type {
  CustomExerciseRow,
  SetRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from "@/lib/local/types";
import { TABLES, type TableName, type WireRow } from "@/lib/sync/tables";
import type { ImportedWorkout } from "./parsers";

// Stable ids: the same exported workout always maps to the same row ids, so
// re-importing a file can never create duplicates (here or after syncing).
export async function deterministicUuid(key: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)),
  );
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50; // version 5 layout
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface ImportSummary {
  imported: number;
  skippedExisting: number;
  sets: number;
  customExercises: number;
}

interface Options {
  chunkSize?: number;
  onProgress?: (processedWorkouts: number, totalWorkouts: number) => void;
}

type Item = { table: TableName; row: WireRow };

export async function runImport(
  db: LocalDb,
  workouts: ImportedWorkout[],
  options: Options = {},
): Promise<ImportSummary> {
  const { chunkSize = 25, onProgress } = options;
  const summary: ImportSummary = {
    imported: 0,
    skippedExisting: 0,
    sets: 0,
    customExercises: 0,
  };

  // name (normalized) -> exercise id, for custom exercises that already exist or were just created
  const custom = new Map<string, string>();
  for (const c of (await db.custom_exercises
    .filter((e) => !e.deleted_at)
    .toArray()) as CustomExerciseRow[]) {
    custom.set(normalizeName(c.name), c.id);
  }

  let processed = 0;
  for (let i = 0; i < workouts.length; i += chunkSize) {
    const items: Item[] = [];
    for (const w of workouts.slice(i, i + chunkSize)) {
      const workoutKey = `${w.source}|${w.startedAt}|${w.title ?? ""}`;
      const workoutId = await deterministicUuid(`workout|${workoutKey}`);
      // Includes soft-deleted rows: a workout the user removed stays removed.
      if (await db.workouts.get(workoutId)) {
        summary.skippedExisting++;
        continue;
      }
      items.push({
        table: "workouts",
        row: {
          id: workoutId,
          title: w.title?.slice(0, 80) ?? null,
          started_at: w.startedAt,
          ended_at: w.endedAt,
          notes: w.notes?.slice(0, 2000) ?? null,
          source: w.source,
          deleted_at: null,
        } satisfies Omit<WorkoutRow, never>,
      });

      for (const [exIndex, ex] of w.exercises.entries()) {
        const catalog = matchExercise(ex.name);
        let exerciseId = catalog?.id;
        if (!exerciseId) {
          const key = normalizeName(ex.name);
          exerciseId = custom.get(key);
          if (!exerciseId) {
            exerciseId = await deterministicUuid(`custom|${key}`);
            custom.set(key, exerciseId);
            summary.customExercises++;
            items.push({
              table: "custom_exercises",
              row: {
                id: exerciseId,
                name: ex.name.slice(0, 80),
                muscle_group: null,
                equipment: null,
                deleted_at: null,
              } satisfies CustomExerciseRow,
            });
          }
        }
        const rowId = await deterministicUuid(
          `exercise|${workoutKey}|${exIndex}`,
        );
        items.push({
          table: "workout_exercises",
          row: {
            id: rowId,
            workout_id: workoutId,
            exercise_id: exerciseId,
            position: exIndex,
            notes: null,
            deleted_at: null,
          } satisfies WorkoutExerciseRow,
        });
        for (const [setIndex, s] of ex.sets.entries()) {
          items.push({
            table: "workout_sets",
            row: {
              id: await deterministicUuid(
                `set|${workoutKey}|${exIndex}|${setIndex}`,
              ),
              workout_exercise_id: rowId,
              position: setIndex,
              set_type: s.type,
              weight_kg: s.weightKg,
              reps: s.reps,
              rpe: s.rpe,
              completed: true,
              deleted_at: null,
            } satisfies SetRow,
          });
          summary.sets++;
        }
      }
      summary.imported++;
    }
    if (items.length) await saveRows(db, items, TABLES);
    processed = Math.min(workouts.length, i + chunkSize);
    onProgress?.(processed, workouts.length);
  }
  return summary;
}
