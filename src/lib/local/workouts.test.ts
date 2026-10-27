// Pins down the live training log operations: ordering, soft deletes, atomic edits and the "last time" lookup that pre-fills sets.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalDb, type LocalDb } from "./db";
import { saveRow, softDeleteWorkout } from "./repo";
import type { SetRow } from "./types";
import {
  addExercise,
  addSet,
  finishWorkout,
  lastPerformance,
  removeExercise,
  removeSet,
  startWorkout,
  updateSet,
} from "./workouts";

let db: LocalDb;
let n = 0;
beforeEach(() => {
  db = createLocalDb(`w-${++n}`);
});

const activeSets = async (exerciseRowId: string) =>
  (await db.workout_sets
    .where("workout_exercise_id")
    .equals(exerciseRowId)
    .filter((s) => !s.deleted_at)
    .sortBy("position")) as SetRow[];

describe("workout helpers", () => {
  it("starts a workout and queues it for sync", async () => {
    const w = await startWorkout(db);
    expect(w.source).toBe("app");
    expect((await db.workouts.get(w.id))?.started_at).toBe(w.started_at);
    expect(await db.outbox.count()).toBe(1);
  });

  it("adds exercises in order and sets copy the previous set", async () => {
    const w = await startWorkout(db);
    const e1 = await addExercise(db, w.id, "barbell-bench-press");
    const e2 = await addExercise(db, w.id, "pull-up");
    expect([e1.position, e2.position]).toEqual([0, 1]);

    const s1 = await addSet(db, e1.id);
    expect(s1).toMatchObject({
      position: 0,
      weight_kg: null,
      reps: null,
      completed: false,
    });
    await updateSet(db, s1.id, { weight_kg: 60, reps: 8 });
    const s2 = await addSet(db, e1.id);
    expect(s2).toMatchObject({
      position: 1,
      weight_kg: 60,
      reps: 8,
      completed: false,
    });
  });

  it("concurrent edits of different fields of one set are both kept", async () => {
    const w = await startWorkout(db);
    const e = await addExercise(db, w.id, "barbell-bench-press");
    const s = await addSet(db, e.id);
    // what happens when an input blurs (saves reps) while the done button is tapped
    await Promise.all([
      updateSet(db, s.id, { reps: 8 }),
      updateSet(db, s.id, { weight_kg: 60 }),
      updateSet(db, s.id, { completed: true }),
    ]);
    expect(await db.workout_sets.get(s.id)).toMatchObject({
      reps: 8,
      weight_kg: 60,
      completed: true,
    });
  });

  it("removing an exercise soft-deletes it and its sets", async () => {
    const w = await startWorkout(db);
    const e = await addExercise(db, w.id, "pull-up");
    const s = await addSet(db, e.id);
    await removeExercise(db, e.id);
    expect((await db.workout_exercises.get(e.id))?.deleted_at).not.toBeNull();
    expect((await db.workout_sets.get(s.id))?.deleted_at).not.toBeNull();
    expect(await activeSets(e.id)).toHaveLength(0);
  });

  it("finishWorkout sets ended_at and drops empty, unfinished sets", async () => {
    const w = await startWorkout(db);
    const e = await addExercise(db, w.id, "barbell-bench-press");
    const empty = await addSet(db, e.id);
    const done = await addSet(db, e.id);
    await updateSet(db, done.id, { weight_kg: 60, reps: 8, completed: true });
    await finishWorkout(db, w.id);
    expect((await db.workouts.get(w.id))?.ended_at).not.toBeNull();
    expect((await db.workout_sets.get(empty.id))?.deleted_at).not.toBeNull();
    expect((await db.workout_sets.get(done.id))?.deleted_at).toBeNull();
  });

  it("lastPerformance returns the sets of the most recent earlier workout with that exercise", async () => {
    const old = await startWorkout(db);
    await saveRow(db, "workouts", {
      ...old,
      started_at: "2026-10-01T10:00:00.000Z",
    });
    const oe = await addExercise(db, old.id, "barbell-bench-press");
    const os = await addSet(db, oe.id);
    await updateSet(db, os.id, { weight_kg: 55, reps: 10, completed: true });

    const current = await startWorkout(db);
    await addExercise(db, current.id, "barbell-bench-press");
    const last = await lastPerformance(db, "barbell-bench-press", current.id);
    expect(last.map((s) => [s.weight_kg, s.reps])).toEqual([[55, 10]]);
    expect(await lastPerformance(db, "pull-up", current.id)).toEqual([]);
  });

  it("keeps positions unique and ordered after deleting a set in the middle", async () => {
    const w = await startWorkout(db);
    const e = await addExercise(db, w.id, "barbell-bench-press");
    const [a, b, c] = [
      await addSet(db, e.id),
      await addSet(db, e.id),
      await addSet(db, e.id),
    ];
    await updateSet(db, c.id, { weight_kg: 70, reps: 3 });
    await removeSet(db, a.id);
    const d = await addSet(db, e.id);
    const sets = await activeSets(e.id);
    expect(new Set(sets.map((s) => s.position)).size).toBe(sets.length);
    expect(sets.map((s) => s.id)).toEqual([b.id, c.id, d.id]);
    expect(d).toMatchObject({ weight_kg: 70, reps: 3 }); // copies the previous *last* set
  });

  it("keeps exercise positions unique after removing one", async () => {
    const w = await startWorkout(db);
    const e1 = await addExercise(db, w.id, "pull-up");
    await addExercise(db, w.id, "barbell-back-squat");
    await removeExercise(db, e1.id);
    const e3 = await addExercise(db, w.id, "leg-press");
    const rows = await db.workout_exercises
      .where("workout_id")
      .equals(w.id)
      .filter((x) => !x.deleted_at)
      .toArray();
    expect(new Set(rows.map((r) => r.position)).size).toBe(rows.length);
    expect(e3.position).toBeGreaterThan(1);
  });

  it("lastPerformance only looks at earlier workouts and skips ones without sets", async () => {
    const mk = async (startedAt: string, weight: number | null) => {
      const w = await startWorkout(db);
      await saveRow(db, "workouts", { ...w, started_at: startedAt });
      const e = await addExercise(db, w.id, "barbell-bench-press");
      if (weight !== null) {
        const s = await addSet(db, e.id);
        await updateSet(db, s.id, {
          weight_kg: weight,
          reps: 5,
          completed: true,
        });
      }
      return w;
    };
    const oldest = await mk("2026-09-01T10:00:00.000Z", 50);
    const middle = await mk("2026-10-01T10:00:00.000Z", 55);
    const newest = await mk("2026-11-01T10:00:00.000Z", 60);
    const empty = await mk("2026-10-15T10:00:00.000Z", null);

    expect(
      (await lastPerformance(db, "barbell-bench-press", newest.id))[0]
        .weight_kg,
    ).toBe(55); // skips the empty Oct 15 one
    expect(
      (await lastPerformance(db, "barbell-bench-press", middle.id))[0]
        .weight_kg,
    ).toBe(50); // not the newer 60
    expect(await lastPerformance(db, "barbell-bench-press", oldest.id)).toEqual(
      [],
    );
    expect(
      (await lastPerformance(db, "barbell-bench-press", empty.id))[0].weight_kg,
    ).toBe(55);
  });

  it("deleting a workout is one atomic operation covering exercises and sets", async () => {
    const w = await startWorkout(db);
    const e = await addExercise(db, w.id, "pull-up");
    const s = await addSet(db, e.id);
    await softDeleteWorkout(db, w.id);
    for (const row of [
      await db.workouts.get(w.id),
      await db.workout_exercises.get(e.id),
      await db.workout_sets.get(s.id),
    ]) {
      expect(row?.deleted_at).not.toBeNull();
    }
  });
});
