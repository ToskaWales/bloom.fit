// Pins down templates: saved from a workout (working sets only), pre-filled from the last performance, soft-deleted together with their exercises.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalDb, type LocalDb } from "./db";
import type {
  SetRow,
  TemplateExerciseRow,
  TemplateRow,
  WorkoutExerciseRow,
} from "./types";
import {
  deleteTemplate,
  saveWorkoutAsTemplate,
  startWorkoutFromTemplate,
} from "./templates";
import { addExercise, addSet, startWorkout, updateSet } from "./workouts";

let db: LocalDb;
let n = 0;
beforeEach(() => {
  db = createLocalDb(`tpl-${++n}`);
});

async function loggedWorkout() {
  const w = await startWorkout(db, "Push A");
  const bench = await addExercise(db, w.id, "barbell-bench-press");
  const ohp = await addExercise(db, w.id, "overhead-press");
  const warm = await addSet(db, bench.id);
  await updateSet(db, warm.id, {
    set_type: "warmup",
    weight_kg: 40,
    reps: 10,
    completed: true,
  });
  for (const [kg, reps] of [
    [60, 8],
    [60, 7],
    [57.5, 8],
  ] as const) {
    const s = await addSet(db, bench.id);
    await updateSet(db, s.id, { weight_kg: kg, reps, completed: true });
  }
  const o = await addSet(db, ohp.id);
  await updateSet(db, o.id, { weight_kg: 40, reps: 8, completed: true });
  return w;
}

describe("templates", () => {
  it("saves a workout as a template with exercises in order and working-set counts", async () => {
    const w = await loggedWorkout();
    const t = await saveWorkoutAsTemplate(db, w.id, "Push A");
    const rows = (await db.template_exercises
      .where("template_id")
      .equals(t.id)
      .sortBy("position")) as TemplateExerciseRow[];
    expect(rows.map((r) => [r.exercise_id, r.set_count])).toEqual([
      ["barbell-bench-press", 3], // warm-up not counted
      ["overhead-press", 1],
    ]);
    expect((await db.templates.get(t.id)) as TemplateRow).toMatchObject({
      name: "Push A",
    });
  });

  it("starts a workout from a template, pre-filled with the last performance", async () => {
    const past = await loggedWorkout();
    const t = await saveWorkoutAsTemplate(db, past.id, "Push A");

    const w = await startWorkoutFromTemplate(db, t.id);
    expect(w.title).toBe("Push A");
    const exercises = (await db.workout_exercises
      .where("workout_id")
      .equals(w.id)
      .sortBy("position")) as WorkoutExerciseRow[];
    expect(exercises.map((e) => e.exercise_id)).toEqual([
      "barbell-bench-press",
      "overhead-press",
    ]);

    const benchSets = (await db.workout_sets
      .where("workout_exercise_id")
      .equals(exercises[0].id)
      .sortBy("position")) as SetRow[];
    expect(benchSets.map((s) => [s.weight_kg, s.reps, s.completed])).toEqual([
      [60, 8, false],
      [60, 7, false],
      [57.5, 8, false],
    ]);
    // the new workout starts after the past one, so its history is the past one
    expect(new Date(w.started_at).getTime()).toBeGreaterThanOrEqual(
      new Date(past.started_at).getTime(),
    );
  });

  it("starts empty sets for an exercise that was never done", async () => {
    const w = await startWorkout(db, "Neu");
    const e = await addExercise(db, w.id, "pull-up");
    await addSet(db, e.id);
    const t = await saveWorkoutAsTemplate(db, w.id, "Pull");
    await db.workout_sets.clear();
    await db.workout_exercises.clear();
    await db.workouts.clear();
    const started = await startWorkoutFromTemplate(db, t.id);
    const ex = (
      await db.workout_exercises
        .where("workout_id")
        .equals(started.id)
        .toArray()
    )[0];
    const sets = (await db.workout_sets
      .where("workout_exercise_id")
      .equals(ex.id)
      .toArray()) as SetRow[];
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ weight_kg: null, reps: null });
  });

  it("deleting a template soft-deletes it and its exercises", async () => {
    const w = await loggedWorkout();
    const t = await saveWorkoutAsTemplate(db, w.id, "Push A");
    await deleteTemplate(db, t.id);
    expect((await db.templates.get(t.id))?.deleted_at).not.toBeNull();
    const rows = await db.template_exercises
      .where("template_id")
      .equals(t.id)
      .toArray();
    expect(rows.every((r) => r.deleted_at)).toBe(true);
  });

  it("rejects empty names and truncates long ones to the server limit", async () => {
    const w = await loggedWorkout();
    await expect(saveWorkoutAsTemplate(db, w.id, "   ")).rejects.toThrow();
    const t = await saveWorkoutAsTemplate(db, w.id, "x".repeat(200));
    expect(((await db.templates.get(t.id)) as TemplateRow).name).toHaveLength(
      80,
    );
  });
});
