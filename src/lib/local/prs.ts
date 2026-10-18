import type { LocalDb } from "./db";
import type { SetRow, WorkoutExerciseRow, WorkoutRow } from "./types";
import { findPRs, type PrKind } from "@/lib/workout/prs";

// Set id -> kinds of personal record achieved in this workout.
export async function prsForWorkout(
  db: LocalDb,
  workoutId: string,
): Promise<Map<string, PrKind[]>> {
  const result = new Map<string, PrKind[]>();
  const workout = (await db.workouts.get(workoutId)) as WorkoutRow | undefined;
  if (!workout) return result;

  const exercises = (await db.workout_exercises
    .where("workout_id")
    .equals(workoutId)
    .filter((e) => !e.deleted_at)
    .sortBy("position")) as WorkoutExerciseRow[];

  // An exercise can appear twice in one workout; treat its sets as one sequence.
  const byExercise = new Map<string, WorkoutExerciseRow[]>();
  for (const ex of exercises)
    byExercise.set(ex.exercise_id, [
      ...(byExercise.get(ex.exercise_id) ?? []),
      ex,
    ]);

  for (const [exerciseId, rows] of byExercise) {
    const current: SetRow[] = [];
    for (const ex of rows) {
      current.push(
        ...((await db.workout_sets
          .where("workout_exercise_id")
          .equals(ex.id)
          .filter((s) => !s.deleted_at)
          .sortBy("position")) as SetRow[]),
      );
    }
    // Earlier occurrences, fetched in bulk: one query for the rows, one for their
    // workouts and one for all their sets (history can span thousands of sets).
    const earlier = (
      (await db.workout_exercises
        .where("exercise_id")
        .equals(exerciseId)
        .toArray()) as WorkoutExerciseRow[]
    ).filter((ex) => !ex.deleted_at && ex.workout_id !== workoutId);
    const workouts = (await db.workouts.bulkGet([
      ...new Set(earlier.map((ex) => ex.workout_id)),
    ])) as (WorkoutRow | undefined)[];
    const valid = new Set(
      workouts
        .filter(
          (w): w is WorkoutRow =>
            !!w && !w.deleted_at && w.started_at < workout.started_at,
        )
        .map((w) => w.id),
    );
    const ids = earlier
      .filter((ex) => valid.has(ex.workout_id))
      .map((ex) => ex.id);
    const history = ids.length
      ? ((await db.workout_sets
          .where("workout_exercise_id")
          .anyOf(ids)
          .toArray()) as SetRow[])
      : [];
    for (const [setId, kinds] of findPRs(history, current))
      result.set(setId, kinds);
  }
  return result;
}
