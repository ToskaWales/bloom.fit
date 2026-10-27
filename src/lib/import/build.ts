// Writes parsed workouts into the local database (and from there to the server via
// normal sync). Ids are deterministic and user-scoped, so importing the same file
// again, or on a second device, adds nothing new. Parsing is parsers.ts, id
// derivation is src/lib/ids.ts, row writing is local/repo.ts.
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

// Re-exported for existing callers/tests; the implementation lives in src/lib/ids.ts.
export { deterministicUuid } from "@/lib/ids";
import { deterministicUuid } from "@/lib/ids";

// Counts for the result message; skippedExisting = workouts that were already imported (or deleted since).
export interface ImportSummary {
  imported: number;
  skippedExisting: number;
  sets: number;
  customExercises: number;
}

// chunkSize = workouts per database transaction (keeps the UI responsive for big files).
interface Options {
  chunkSize?: number;
  onProgress?: (processedWorkouts: number, totalWorkouts: number) => void;
}

type Item = { table: TableName; row: WireRow };

// Idempotent: a workout whose deterministic id already exists locally (even
// soft-deleted) is skipped, so re-imports never duplicate or resurrect anything.
// Exercises not in the catalog become custom exercises, reused by normalised name.
export async function runImport(
  db: LocalDb,
  userId: string,
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
  for (const c of (await db.custom_exercises.toArray()) as CustomExerciseRow[]) {
    custom.set(normalizeName(c.name), c.id);
  }

  let processed = 0;
  for (let i = 0; i < workouts.length; i += chunkSize) {
    const items: Item[] = [];
    for (const w of workouts.slice(i, i + chunkSize)) {
      // Scoped to the user (ids are global in the database) and built from the raw
      // export text, so the same file gives the same ids in any timezone.
      const workoutKey = `${userId}|${w.source}|${w.sourceKey}`;
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
            exerciseId = await deterministicUuid(`${userId}|custom|${key}`);
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
