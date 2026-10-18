import type { LocalDb } from "./db";
import { saveRow } from "./repo";
import type {
  SetRow,
  TemplateExerciseRow,
  TemplateRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from "./types";
import { addExercise, lastPerformance, startWorkout } from "./workouts";

const MAX_SETS = 20;
const everything = (db: LocalDb) => [
  db.workouts,
  db.workout_exercises,
  db.workout_sets,
  db.templates,
  db.template_exercises,
  db.outbox,
];

export async function saveWorkoutAsTemplate(
  db: LocalDb,
  workoutId: string,
  name: string,
): Promise<TemplateRow> {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error("Template name required");
  return db.transaction("rw", everything(db), async () => {
    const template: TemplateRow = {
      id: crypto.randomUUID(),
      name: clean,
      deleted_at: null,
    };
    await saveRow(db, "templates", template);
    const exercises = (await db.workout_exercises
      .where("workout_id")
      .equals(workoutId)
      .filter((e) => !e.deleted_at)
      .sortBy("position")) as WorkoutExerciseRow[];
    let position = 0;
    for (const ex of exercises) {
      const sets = (await db.workout_sets
        .where("workout_exercise_id")
        .equals(ex.id)
        .filter((s) => !s.deleted_at)
        .toArray()) as SetRow[];
      const working = sets.filter((s) => s.set_type !== "warmup").length;
      const row: TemplateExerciseRow = {
        id: crypto.randomUUID(),
        template_id: template.id,
        exercise_id: ex.exercise_id,
        position: position++,
        set_count: Math.min(MAX_SETS, Math.max(1, working)),
        deleted_at: null,
      };
      await saveRow(db, "template_exercises", row);
    }
    return template;
  });
}

// New workout with the template's exercises; each set starts from what the user
// did last time (set by set, falling back to the last set), so most sets need no typing.
export async function startWorkoutFromTemplate(
  db: LocalDb,
  templateId: string,
): Promise<WorkoutRow> {
  return db.transaction("rw", everything(db), async () => {
    const template = (await db.templates.get(templateId)) as
      TemplateRow | undefined;
    if (!template || template.deleted_at) throw new Error("Template not found");
    const workout = await startWorkout(db, template.name);
    const rows = (await db.template_exercises
      .where("template_id")
      .equals(templateId)
      .filter((r) => !r.deleted_at)
      .sortBy("position")) as TemplateExerciseRow[];

    for (const row of rows) {
      const ex = await addExercise(db, workout.id, row.exercise_id);
      const last = (
        await lastPerformance(db, row.exercise_id, workout.id)
      ).filter((s) => s.set_type !== "warmup");
      for (let i = 0; i < row.set_count; i++) {
        const source = last[i] ?? last[last.length - 1];
        const set: SetRow = {
          id: crypto.randomUUID(),
          workout_exercise_id: ex.id,
          position: i,
          set_type: "normal",
          weight_kg: source?.weight_kg ?? null,
          reps: source?.reps ?? null,
          rpe: null,
          completed: false,
          deleted_at: null,
        };
        await saveRow(db, "workout_sets", set);
      }
    }
    return workout;
  });
}

export async function deleteTemplate(
  db: LocalDb,
  templateId: string,
): Promise<void> {
  await db.transaction(
    "rw",
    [db.templates, db.template_exercises, db.outbox],
    async () => {
      const now = new Date().toISOString();
      const rows = (await db.template_exercises
        .where("template_id")
        .equals(templateId)
        .toArray()) as TemplateExerciseRow[];
      for (const r of rows)
        await saveRow(db, "template_exercises", {
          ...r,
          deleted_at: r.deleted_at ?? now,
        });
      const t = (await db.templates.get(templateId)) as TemplateRow | undefined;
      if (t)
        await saveRow(db, "templates", {
          ...t,
          deleted_at: t.deleted_at ?? now,
        });
    },
  );
}
