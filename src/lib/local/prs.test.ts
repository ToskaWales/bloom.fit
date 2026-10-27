// Pins down personal-record detection against earlier workouts only (never later ones, never deleted ones).
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalDb, type LocalDb } from "./db";
import { prsForWorkout } from "./prs";
import { saveRow } from "./repo";
import { addExercise, addSet, startWorkout, updateSet } from "./workouts";

let db: LocalDb;
let n = 0;
beforeEach(() => {
  db = createLocalDb(`prs-${++n}`);
});

async function workoutAt(
  startedAt: string,
  exerciseId: string,
  sets: [number, number][],
) {
  const w = await startWorkout(db);
  await saveRow(db, "workouts", { ...w, started_at: startedAt });
  const e = await addExercise(db, w.id, exerciseId);
  const ids: string[] = [];
  for (const [weight, reps] of sets) {
    const s = await addSet(db, e.id);
    await updateSet(db, s.id, { weight_kg: weight, reps, completed: true });
    ids.push(s.id);
  }
  return { w, e, ids };
}

describe("prsForWorkout", () => {
  it("compares against earlier workouts of the same exercise only", async () => {
    await workoutAt("2026-10-01T10:00:00.000Z", "barbell-bench-press", [
      [60, 8],
    ]);
    await workoutAt("2026-12-01T10:00:00.000Z", "barbell-bench-press", [
      [100, 5],
    ]); // later: must not count as history
    await workoutAt("2026-10-02T10:00:00.000Z", "pull-up", [[20, 5]]); // other exercise
    const cur = await workoutAt(
      "2026-11-01T10:00:00.000Z",
      "barbell-bench-press",
      [
        [65, 8],
        [55, 8],
      ],
    );

    const prs = await prsForWorkout(db, cur.w.id);
    expect(prs.get(cur.ids[0])).toContain("weight");
    expect(prs.has(cur.ids[1])).toBe(false);
  });

  it("returns nothing for the first workout with an exercise", async () => {
    const cur = await workoutAt(
      "2026-11-01T10:00:00.000Z",
      "barbell-bench-press",
      [[65, 8]],
    );
    expect((await prsForWorkout(db, cur.w.id)).size).toBe(0);
  });
});
