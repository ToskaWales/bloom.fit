import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays } from "@/lib/daily/day";
import { pushSchemas } from "@/lib/sync/tables";
import { createLocalDb, type LocalDb } from "./db";
import { patchCheckin, saveCheckin, saveCycleEvent } from "./daily";
import { saveRow } from "./repo";
import {
  engineSignature,
  exerciseSessionsFromDb,
  reactToSuggestion,
  refreshSuggestions,
  suggestionsForDay,
} from "./suggestions";
import type { SuggestionRow } from "./types";
import {
  addExercise,
  addSet,
  finishWorkout,
  startWorkout,
  updateSet,
} from "./workouts";

const USER = "11111111-aaaa-4aaa-8aaa-111111111111";
const today = "2026-10-30";
let db: LocalDb;
let n = 0;
beforeEach(() => {
  db = createLocalDb(`sug-${++n}`);
});

const values = (energy: number, motivation: number, sleepQuality: number) => ({
  sleepQuality,
  sleepHours: null,
  energy,
  motivation,
  hunger: 3,
  symptoms: [],
  note: null,
});

async function history(days = 10) {
  for (let i = 1; i <= days; i++)
    await saveCheckin(db, USER, addDays(today, -i), values(3, 3, 3));
}

async function benchSession(day: string, kg: number, reps: number) {
  const w = await startWorkout(db);
  await saveRow(db, "workouts", {
    ...w,
    started_at: new Date(`${day}T12:00:00`).toISOString(),
  });
  const e = await addExercise(db, w.id, "barbell-bench-press");
  const s = await addSet(db, e.id);
  await updateSet(db, s.id, { weight_kg: kg, reps, completed: true });
  await finishWorkout(db, w.id);
}

describe("refreshSuggestions", () => {
  it("creates a readiness suggestion from today's check-in, valid for the sync schema", async () => {
    await history();
    await saveCheckin(db, USER, today, values(2, 1, 2));
    await refreshSuggestions(db, { userId: USER, today });
    const rows = (await suggestionsForDay(db, today)) as SuggestionRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "readiness",
      status: "shown",
      day: today,
    });
    expect(rows[0].subject).toBe("lower");
    expect(rows[0].params).toMatchObject({ level: "lower", canPush: false });
    expect(pushSchemas.suggestions.safeParse(rows[0]).success).toBe(true);
  });

  it("does nothing without enough history or without today's check-in", async () => {
    await saveCheckin(db, USER, today, values(2, 2, 2));
    await refreshSuggestions(db, { userId: USER, today });
    expect(await suggestionsForDay(db, today)).toHaveLength(0);
  });

  it("is idempotent and does not queue writes when nothing changed", async () => {
    await history();
    await saveCheckin(db, USER, today, values(2, 1, 2));
    await refreshSuggestions(db, { userId: USER, today });
    const queued = await db.outbox.count();
    await refreshSuggestions(db, { userId: USER, today });
    await Promise.all([
      refreshSuggestions(db, { userId: USER, today }),
      refreshSuggestions(db, { userId: USER, today }),
    ]);
    expect(await db.suggestions.count()).toBe(1);
    expect(await db.outbox.count()).toBe(queued);
  });

  it("updates the numbers when the check-in changes but keeps the person's reaction", async () => {
    await history();
    await saveCheckin(db, USER, today, values(2, 1, 2));
    await refreshSuggestions(db, { userId: USER, today });
    const [row] = (await suggestionsForDay(db, today)) as SuggestionRow[];
    await reactToSuggestion(db, row.id, "accepted");
    await patchCheckin(db, USER, today, { energy: 1 });
    await refreshSuggestions(db, { userId: USER, today });
    const [after] = (await suggestionsForDay(db, today)) as SuggestionRow[];
    expect(after.status).toBe("accepted");
    expect(after.reacted_at).not.toBeNull();
    expect(after.params.level).toBe("lower");
    expect(after.params.delta).toBeLessThan(-1.4);
  });

  it("removes today's hint when the check-in no longer supports it", async () => {
    await history();
    await saveCheckin(db, USER, today, values(2, 1, 2));
    await refreshSuggestions(db, { userId: USER, today });
    await db.checkins
      .where("day")
      .equals(today)
      .modify({ deleted_at: "2026-10-30T20:00:00.000Z" });
    await refreshSuggestions(db, { userId: USER, today });
    expect(await suggestionsForDay(db, today)).toHaveLength(0);
  });

  it("stays quiet about a kind the person dismissed within the last two weeks", async () => {
    await history();
    await saveCheckin(db, USER, today, values(2, 1, 2));
    await saveCheckin(db, USER, addDays(today, -3), values(2, 1, 2));
    await refreshSuggestions(db, { userId: USER, today: addDays(today, -3) });
    const [old] = (await suggestionsForDay(
      db,
      addDays(today, -3),
    )) as SuggestionRow[];
    expect(old.kind).toBe("readiness");
    await reactToSuggestion(db, old.id, "dismissed");
    await refreshSuggestions(db, { userId: USER, today });
    expect(await suggestionsForDay(db, today)).toHaveLength(0);
  });

  it("raises a plateau from the workout history, once per exercise per two weeks", async () => {
    for (const [day, kg] of [
      ["2026-08-20", 60],
      ["2026-09-03", 65],
      ["2026-09-10", 65],
      ["2026-10-01", 62.5],
      ["2026-10-08", 65],
      ["2026-10-15", 62.5],
      ["2026-10-22", 65],
    ] as const) {
      await benchSession(day, kg, 5);
    }
    await refreshSuggestions(db, { userId: USER, today });
    const rows = (await suggestionsForDay(db, today)) as SuggestionRow[];
    expect(rows.map((r) => [r.kind, r.subject])).toEqual([
      ["plateau", "barbell-bench-press"],
    ]);
    // a day later it is not raised again
    await refreshSuggestions(db, { userId: USER, today: addDays(today, 1) });
    expect(await suggestionsForDay(db, addDays(today, 1))).toHaveLength(0);
  });

  it("does not rewrite or requeue a hint whose params only came back in another key order", async () => {
    await history();
    await saveCheckin(db, USER, today, values(2, 1, 2));
    await refreshSuggestions(db, { userId: USER, today });
    const [row] = (await suggestionsForDay(db, today)) as SuggestionRow[];
    const { level, delta, canPush } = row.params;
    await db.suggestions.put({ ...row, params: { canPush, delta, level } });
    const queued = await db.outbox.count();
    await refreshSuggestions(db, { userId: USER, today });
    expect(await db.outbox.count()).toBe(queued);
  });

  it("does not remove hints the refresh does not own, and keeps reacted ones", async () => {
    await history();
    await saveCheckin(db, USER, today, values(2, 1, 2));
    await saveRow(db, "suggestions", {
      id: "22222222-aaaa-4aaa-8aaa-222222222222",
      kind: "hunger_note",
      day: today,
      subject: "x",
      params: {},
      status: "shown",
      reacted_at: null,
      deleted_at: null,
    } satisfies SuggestionRow);
    await refreshSuggestions(db, { userId: USER, today });
    await db.checkins
      .where("day")
      .equals(today)
      .modify({ deleted_at: "2026-10-30T20:00:00.000Z" });
    await refreshSuggestions(db, { userId: USER, today });
    const left = await suggestionsForDay(db, today);
    expect(left.map((r) => r.kind)).toEqual(["hunger_note"]);
  });

  it("ignores bodyweight sets (0 kg) and workouts that are still running", async () => {
    for (const day of [
      "2026-08-20",
      "2026-09-03",
      "2026-09-10",
      "2026-10-01",
      "2026-10-08",
      "2026-10-15",
    ])
      await benchSession(day, 0, 12);
    const w = await startWorkout(db); // never finished
    const e = await addExercise(db, w.id, "barbell-bench-press");
    const s = await addSet(db, e.id);
    await updateSet(db, s.id, { weight_kg: 100, reps: 5, completed: true });
    const sessions = await exerciseSessionsFromDb(db, today);
    expect(sessions.size).toBe(0);
  });

  it("raises a safety notice when the period is clearly late and energy is low, and never offers the extra rep then", async () => {
    // regular 28-day cycles, last start long enough ago to be overdue by a week+
    for (const d of [
      "2026-06-01",
      "2026-06-29",
      "2026-07-27",
      "2026-08-24",
      "2026-09-21",
    ])
      await saveCycleEvent(db, USER, "period_start", d);
    for (let i = 1; i <= 12; i++)
      await saveCheckin(db, USER, addDays(today, -i), values(1, 3, 3));
    await saveCheckin(db, USER, today, values(5, 5, 5));
    await refreshSuggestions(db, { userId: USER, today, cycleMode: "natural" });
    const rows = (await suggestionsForDay(db, today)) as SuggestionRow[];
    expect(rows.map((r) => r.kind)).toContain("safety");
    for (const r of rows.filter((r) => r.kind === "readiness"))
      expect(r.params.canPush).toBe(false);
    // not for people who do not track a cycle
    const other = createLocalDb(`sug-other-${n}`);
    for (const d of [
      "2026-06-01",
      "2026-06-29",
      "2026-07-27",
      "2026-08-24",
      "2026-09-21",
    ])
      await saveCycleEvent(other, USER, "period_start", d);
    for (let i = 1; i <= 12; i++)
      await saveCheckin(other, USER, addDays(today, -i), values(1, 3, 3));
    await refreshSuggestions(other, { userId: USER, today, cycleMode: "none" });
    expect(await suggestionsForDay(other, today)).toHaveLength(0);
  });

  it("changes its signature when the data it reads changes", async () => {
    const a = await engineSignature(db, today);
    await saveCheckin(db, USER, today, values(3, 3, 3));
    const b = await engineSignature(db, today);
    expect(b).not.toBe(a);
    expect(await engineSignature(db, today)).toBe(b);
  });
});

describe("reactToSuggestion", () => {
  it("stores the reaction with a timestamp and queues it for sync", async () => {
    await history();
    await saveCheckin(db, USER, today, values(2, 1, 2));
    await refreshSuggestions(db, { userId: USER, today });
    const [row] = (await suggestionsForDay(db, today)) as SuggestionRow[];
    const before = await db.outbox.count();
    await reactToSuggestion(db, row.id, "dismissed");
    const after = (await db.suggestions.get(row.id)) as SuggestionRow;
    expect(after.status).toBe("dismissed");
    expect(after.reacted_at).not.toBeNull();
    expect(await db.outbox.count()).toBe(before + 1);
  });
});
