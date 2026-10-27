// Pins down the data behind the history chart: deleted rows are ignored, hidden weight is never returned, and workouts land on their local calendar day.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { localDay } from "@/lib/daily/day";
import { createLocalDb, type LocalDb } from "./db";
import { saveCheckin, saveCycleEvent, saveWeight } from "./daily";
import { loadOverview } from "./overview-data";
import { saveRow } from "./repo";
import { addExercise, addSet, startWorkout, updateSet } from "./workouts";

const USER = "11111111-aaaa-4aaa-8aaa-111111111111";
let db: LocalDb;
let n = 0;
beforeEach(() => {
  db = createLocalDb(`ov-${++n}`);
});

const empty = {
  sleepQuality: null,
  sleepHours: null,
  energy: null,
  motivation: null,
  hunger: null,
  symptoms: [],
  note: null,
};

async function workoutOn(day: string, kg: number, reps: number) {
  const w = await startWorkout(db);
  const noon = new Date(`${day}T12:00:00`).toISOString(); // local noon of that calendar day
  await saveRow(db, "workouts", { ...w, started_at: noon });
  const e = await addExercise(db, w.id, "barbell-bench-press");
  const s = await addSet(db, e.id);
  await updateSet(db, s.id, { weight_kg: kg, reps, completed: true });
}

describe("loadOverview", () => {
  it("joins check-ins, weights, workout volume and period days for the window", async () => {
    await saveCheckin(db, USER, "2026-10-02", { ...empty, energy: 4 });
    await saveWeight(db, USER, "2026-09-20", 62); // before the window: still feeds the trend
    await saveWeight(db, USER, "2026-10-03", 62.4);
    await workoutOn("2026-10-02", 60, 8);
    await saveCycleEvent(db, USER, "period_start", "2026-10-01");
    await saveCycleEvent(db, USER, "period_end", "2026-10-03");

    const rows = await loadOverview(db, {
      from: "2026-10-01",
      to: "2026-10-05",
      hideWeight: false,
    });
    expect(rows.map((r) => r.day)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
    ]);
    expect(rows[1]).toMatchObject({ energy: 4, volumeKg: 480, period: true });
    expect(rows[2]).toMatchObject({ weightKg: 62.4, period: true });
    expect(rows[3].period).toBe(false);
    expect(rows[0].weightTrend).toBeCloseTo(62, 1); // carried in from 20 Sep
  });

  it("ignores deleted rows and unfinished or warm-up sets in the volume", async () => {
    await saveCheckin(db, USER, "2026-10-02", { ...empty, energy: 4 });
    const row = (await db.checkins.toArray())[0];
    await db.checkins.put({ ...row, deleted_at: "2026-10-03T00:00:00.000Z" });
    await workoutOn("2026-10-02", 60, 8);
    const e = (await db.workout_exercises.toArray())[0];
    const warm = await addSet(db, e.id);
    await updateSet(db, warm.id, {
      weight_kg: 20,
      reps: 10,
      set_type: "warmup",
      completed: true,
    });
    const open = await addSet(db, e.id);
    await updateSet(db, open.id, {
      weight_kg: 100,
      reps: 10,
      completed: false,
    });

    const rows = await loadOverview(db, {
      from: "2026-10-02",
      to: "2026-10-02",
      hideWeight: false,
    });
    expect(rows[0].energy).toBeNull();
    expect(rows[0].volumeKg).toBe(480);
  });

  it("returns no weight values when weight is hidden", async () => {
    await saveWeight(db, USER, "2026-10-02", 62);
    const rows = await loadOverview(db, {
      from: "2026-10-01",
      to: "2026-10-03",
      hideWeight: true,
    });
    expect(
      rows.every((r) => r.weightKg === null && r.weightTrend === null),
    ).toBe(true);
  });

  it("assigns a workout to the local calendar day it was started on", async () => {
    const w = await startWorkout(db);
    const lateEvening = new Date(2026, 9, 2, 23, 40); // local time
    await saveRow(db, "workouts", {
      ...w,
      started_at: lateEvening.toISOString(),
    });
    const e = await addExercise(db, w.id, "pull-up");
    const s = await addSet(db, e.id);
    await updateSet(db, s.id, { weight_kg: 10, reps: 5, completed: true });
    const day = localDay(lateEvening);
    const rows = await loadOverview(db, {
      from: day,
      to: day,
      hideWeight: true,
    });
    expect(rows[0].volumeKg).toBe(50);
  });
});
