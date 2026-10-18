import type { LocalDb } from "./db";
import { patchRow, saveRow } from "./repo";
import type { SetRow, WorkoutExerciseRow, WorkoutRow } from "./types";

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

const allTables = (db: LocalDb) => [
  db.workouts,
  db.workout_exercises,
  db.workout_sets,
  db.outbox,
];

// Next free position among all rows (including soft-deleted ones), so a new
// row never ties with an existing one.
const nextPosition = (rows: { position: number }[]) =>
  rows.reduce((max, r) => Math.max(max, r.position), -1) + 1;

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
  return db.transaction("rw", allTables(db), async () => {
    const existing = (await db.workout_exercises
      .where("workout_id")
      .equals(workoutId)
      .toArray()) as WorkoutExerciseRow[];
    const row: WorkoutExerciseRow = {
      id: uuid(),
      workout_id: workoutId,
      exercise_id: exerciseId,
      position: nextPosition(existing),
      notes: null,
      deleted_at: null,
    };
    await saveRow(db, "workout_exercises", row);
    return row;
  });
}

export async function removeExercise(
  db: LocalDb,
  workoutExerciseId: string,
): Promise<void> {
  await db.transaction("rw", allTables(db), async () => {
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
  });
}

// A new set starts from the previous set's values so repeated sets are one tap.
export async function addSet(
  db: LocalDb,
  workoutExerciseId: string,
): Promise<SetRow> {
  return db.transaction("rw", allTables(db), async () => {
    const all = (await db.workout_sets
      .where("workout_exercise_id")
      .equals(workoutExerciseId)
      .toArray()) as SetRow[];
    const active = all
      .filter((s) => !s.deleted_at)
      .sort((a, b) => a.position - b.position);
    const prev = active[active.length - 1];
    const row: SetRow = {
      id: uuid(),
      workout_exercise_id: workoutExerciseId,
      position: nextPosition(all),
      set_type: "normal",
      weight_kg: prev?.weight_kg ?? null,
      reps: prev?.reps ?? null,
      rpe: null,
      completed: false,
      deleted_at: null,
    };
    await saveRow(db, "workout_sets", row);
    return row;
  });
}

export async function updateSet(
  db: LocalDb,
  setId: string,
  patch: Partial<
    Pick<SetRow, "weight_kg" | "reps" | "rpe" | "set_type" | "completed">
  >,
): Promise<void> {
  await patchRow<SetRow>(db, "workout_sets", setId, (row) => ({
    ...row,
    ...patch,
  }));
}

export async function removeSet(db: LocalDb, setId: string): Promise<void> {
  await patchRow<SetRow>(db, "workout_sets", setId, (row) => ({
    ...row,
    deleted_at: now(),
  }));
}

export async function finishWorkout(
  db: LocalDb,
  workoutId: string,
): Promise<void> {
  await db.transaction("rw", allTables(db), async () => {
    const workout = (await db.workouts.get(workoutId)) as
      WorkoutRow | undefined;
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
  });
}

export async function reopenWorkout(
  db: LocalDb,
  workoutId: string,
): Promise<void> {
  await patchRow<WorkoutRow>(db, "workouts", workoutId, (w) => ({
    ...w,
    ended_at: null,
  }));
}

// Sets of the most recent workout *before* this one that has this exercise with
// at least one set. Uses the exercise_id index, so it stays fast with long histories.
export async function lastPerformance(
  db: LocalDb,
  exerciseId: string,
  currentWorkoutId: string,
): Promise<SetRow[]> {
  const current = (await db.workouts.get(currentWorkoutId)) as
    WorkoutRow | undefined;
  if (!current) return [];
  const rows = (
    (await db.workout_exercises
      .where("exercise_id")
      .equals(exerciseId)
      .toArray()) as WorkoutExerciseRow[]
  ).filter((ex) => !ex.deleted_at && ex.workout_id !== currentWorkoutId);
  const workouts = (await db.workouts.bulkGet([
    ...new Set(rows.map((ex) => ex.workout_id)),
  ])) as (WorkoutRow | undefined)[];
  const startedAt = new Map(
    workouts
      .filter(
        (w): w is WorkoutRow =>
          !!w && !w.deleted_at && w.started_at < current.started_at,
      )
      .map((w) => [w.id, w.started_at]),
  );
  const candidates = rows
    .filter((ex) => startedAt.has(ex.workout_id))
    .sort((a, b) =>
      startedAt.get(b.workout_id)!.localeCompare(startedAt.get(a.workout_id)!),
    );
  for (const ex of candidates) {
    const sets = (await db.workout_sets
      .where("workout_exercise_id")
      .equals(ex.id)
      .filter((s) => !s.deleted_at)
      .sortBy("position")) as SetRow[];
    if (sets.length) return sets;
  }
  return [];
}
