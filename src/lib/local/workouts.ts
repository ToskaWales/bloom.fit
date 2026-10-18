import type { LocalDb } from "./db";
import { saveRow } from "./repo";
import type { SetRow, WorkoutExerciseRow, WorkoutRow } from "./types";

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export async function startWorkout(
  db: LocalDb,
  title: string | null = null,
): Promise<WorkoutRow> {
  const workout: WorkoutRow = {
    id: uuid(),
    title,
    started_at: now(),
    ended_at: null,
    notes: null,
    source: "app",
    deleted_at: null,
  };
  await saveRow(db, "workouts", workout);
  return workout;
}

export async function addExercise(
  db: LocalDb,
  workoutId: string,
  exerciseId: string,
): Promise<WorkoutExerciseRow> {
  const existing = await db.workout_exercises
    .where("workout_id")
    .equals(workoutId)
    .filter((e) => !e.deleted_at)
    .count();
  const row: WorkoutExerciseRow = {
    id: uuid(),
    workout_id: workoutId,
    exercise_id: exerciseId,
    position: existing,
    notes: null,
    deleted_at: null,
  };
  await saveRow(db, "workout_exercises", row);
  return row;
}

export async function removeExercise(
  db: LocalDb,
  workoutExerciseId: string,
): Promise<void> {
  const ex = (await db.workout_exercises.get(workoutExerciseId)) as
    WorkoutExerciseRow | undefined;
  if (!ex) return;
  const sets = (await db.workout_sets
    .where("workout_exercise_id")
    .equals(workoutExerciseId)
    .toArray()) as SetRow[];
  const stamp = now();
  for (const s of sets)
    if (!s.deleted_at)
      await saveRow(db, "workout_sets", { ...s, deleted_at: stamp });
  await saveRow(db, "workout_exercises", { ...ex, deleted_at: stamp });
}

// A new set starts from the previous set's values so repeated sets are one tap.
export async function addSet(
  db: LocalDb,
  workoutExerciseId: string,
): Promise<SetRow> {
  const sets = (await db.workout_sets
    .where("workout_exercise_id")
    .equals(workoutExerciseId)
    .filter((s) => !s.deleted_at)
    .sortBy("position")) as SetRow[];
  const prev = sets[sets.length - 1];
  const row: SetRow = {
    id: uuid(),
    workout_exercise_id: workoutExerciseId,
    position: sets.length,
    set_type: "normal",
    weight_kg: prev?.weight_kg ?? null,
    reps: prev?.reps ?? null,
    rpe: null,
    completed: false,
    deleted_at: null,
  };
  await saveRow(db, "workout_sets", row);
  return row;
}

export async function updateSet(
  db: LocalDb,
  setId: string,
  patch: Partial<
    Pick<SetRow, "weight_kg" | "reps" | "rpe" | "set_type" | "completed">
  >,
): Promise<void> {
  const row = (await db.workout_sets.get(setId)) as SetRow | undefined;
  if (!row) return;
  await saveRow(db, "workout_sets", { ...row, ...patch });
}

export async function removeSet(db: LocalDb, setId: string): Promise<void> {
  const row = (await db.workout_sets.get(setId)) as SetRow | undefined;
  if (row) await saveRow(db, "workout_sets", { ...row, deleted_at: now() });
}

export async function finishWorkout(
  db: LocalDb,
  workoutId: string,
): Promise<void> {
  const workout = (await db.workouts.get(workoutId)) as WorkoutRow | undefined;
  if (!workout) return;
  const exercises = await db.workout_exercises
    .where("workout_id")
    .equals(workoutId)
    .filter((e) => !e.deleted_at)
    .toArray();
  for (const ex of exercises) {
    const sets = (await db.workout_sets
      .where("workout_exercise_id")
      .equals(ex.id)
      .filter((s) => !s.deleted_at)
      .toArray()) as SetRow[];
    for (const s of sets) {
      if (!s.completed && s.weight_kg == null && s.reps == null) {
        await saveRow(db, "workout_sets", { ...s, deleted_at: now() });
      }
    }
  }
  await saveRow(db, "workouts", {
    ...workout,
    ended_at: workout.ended_at ?? now(),
  });
}

export async function reopenWorkout(
  db: LocalDb,
  workoutId: string,
): Promise<void> {
  const workout = (await db.workouts.get(workoutId)) as WorkoutRow | undefined;
  if (workout) await saveRow(db, "workouts", { ...workout, ended_at: null });
}

// Sets of the most recent earlier workout that contained this exercise.
export async function lastPerformance(
  db: LocalDb,
  exerciseId: string,
  excludeWorkoutId: string,
): Promise<SetRow[]> {
  const rows = (await db.workout_exercises
    .filter((e) => e.exercise_id === exerciseId && !e.deleted_at)
    .toArray()) as WorkoutExerciseRow[];
  let best: { ex: WorkoutExerciseRow; startedAt: string } | undefined;
  for (const ex of rows) {
    if (ex.workout_id === excludeWorkoutId) continue;
    const w = (await db.workouts.get(ex.workout_id)) as WorkoutRow | undefined;
    if (!w || w.deleted_at) continue;
    if (!best || w.started_at > best.startedAt)
      best = { ex, startedAt: w.started_at };
  }
  if (!best) return [];
  return (await db.workout_sets
    .where("workout_exercise_id")
    .equals(best.ex.id)
    .filter((s) => !s.deleted_at)
    .sortBy("position")) as SetRow[];
}
