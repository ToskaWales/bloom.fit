// Pins down how the engine's hints are stored locally: idempotent refresh, her reactions are never overwritten, cooldowns, the safety notice, and that weight/food are only read when allowed.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays } from "@/lib/daily/day";
import { pushSchemas } from "@/lib/sync/tables";
import { createLocalDb, type LocalDb } from "./db";
import { patchCheckin, saveCheckin, saveCycleEvent, saveWeight } from "./daily";
import { addQuickEntry, wipeNutrition } from "./nutrition";
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

  it("removes a stale hint nobody reacted to, but keeps one she accepted", async () => {
    await history();
    await saveCheckin(db, USER, today, values(2, 1, 2));
    await refreshSuggestions(db, { userId: USER, today });
    const [row] = (await suggestionsForDay(db, today)) as SuggestionRow[];
    await reactToSuggestion(db, row.id, "accepted");
    await db.checkins
      .where("day")
      .equals(today)
      .modify({ deleted_at: "2026-10-30T20:00:00.000Z" });
    await refreshSuggestions(db, { userId: USER, today });
    expect((await suggestionsForDay(db, today)).map((r) => r.status)).toEqual([
      "accepted",
    ]);
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

describe("refreshSuggestions: cycle mode", () => {
  it("produces no safety notice or pattern for hormonal or no cycle, and removes an old unreacted one", async () => {
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
    await saveCheckin(db, USER, today, values(3, 3, 3));
    await refreshSuggestions(db, { userId: USER, today, cycleMode: "natural" });
    expect((await suggestionsForDay(db, today)).map((r) => r.kind)).toContain(
      "safety",
    );
    await refreshSuggestions(db, {
      userId: USER,
      today,
      cycleMode: "hormonal",
    });
    expect(await suggestionsForDay(db, today)).toHaveLength(0);
  });
});

describe("refreshSuggestions: nutrition", () => {
  async function lowIntakeAndEnergy(target: LocalDb) {
    for (let i = 1; i <= 12; i++) {
      await saveCheckin(target, USER, addDays(today, -i), values(1, 3, 3));
      for (const name of ["a", "b"])
        await addQuickEntry(target, {
          day: addDays(today, -i),
          meal: null,
          name,
          kcal: 450,
          proteinG: null,
        });
    }
    await saveCheckin(target, USER, today, values(5, 5, 5));
  }
  async function trainDays(target: LocalDb, days: number) {
    const was = db;
    db = target;
    for (let i = 1; i <= days; i++)
      await benchSession(addDays(today, -i), 60, 5);
    db = was;
  }

  it("raises the notice without a period signal when intake is low, energy is low and she trains regularly", async () => {
    await lowIntakeAndEnergy(db);
    await trainDays(db, 8);
    await refreshSuggestions(db, {
      userId: USER,
      today,
      cycleMode: "none",
      nutritionMode: "log",
    });
    const rows = (await suggestionsForDay(db, today)) as SuggestionRow[];
    expect(rows.find((r) => r.kind === "safety")).toMatchObject({
      subject: "energy",
      params: { lowIntake: true },
    });
    for (const r of rows.filter((r) => r.kind === "readiness"))
      expect(r.params.canPush).toBe(false);
  });

  it("counts training days from finished workouts, also with high-rep and bodyweight-only sets", async () => {
    await lowIntakeAndEnergy(db);
    for (let i = 1; i <= 8; i++) {
      const w = await startWorkout(db);
      await saveRow(db, "workouts", {
        ...w,
        started_at: new Date(`${addDays(today, -i)}T12:00:00`).toISOString(),
      });
      const e = await addExercise(db, w.id, "barbell-bench-press");
      const set = await addSet(db, e.id);
      await updateSet(db, set.id, { weight_kg: 0, reps: 20, completed: true }); // no e1RM possible
      await finishWorkout(db, w.id);
    }
    await refreshSuggestions(db, {
      userId: USER,
      today,
      cycleMode: "none",
      nutritionMode: "log",
    });
    expect((await suggestionsForDay(db, today)).map((r) => r.kind)).toContain(
      "safety",
    );
  });

  it("people tracking a natural cycle but without any logged period still get the intake notice", async () => {
    await lowIntakeAndEnergy(db);
    await trainDays(db, 8);
    await refreshSuggestions(db, {
      userId: USER,
      today,
      cycleMode: "natural",
      nutritionMode: "log",
    });
    expect(
      (await suggestionsForDay(db, today)).find((r) => r.kind === "safety")
        ?.subject,
    ).toBe("energy");
  });

  it("wipes nutrition data and derived hints from the device when consent is withdrawn", async () => {
    await lowIntakeAndEnergy(db);
    await trainDays(db, 8);
    await refreshSuggestions(db, {
      userId: USER,
      today,
      cycleMode: "none",
      nutritionMode: "log",
    });
    await wipeNutrition(db);
    expect(await db.food_logs.count()).toBe(0);
    expect(await db.outbox.filter((e) => e.table === "food_logs").count()).toBe(
      0,
    );
    expect(
      (await suggestionsForDay(db, today)).map((r) => r.kind),
    ).not.toContain("safety");
  });

  it("never reads food entries when nutrition is off", async () => {
    await lowIntakeAndEnergy(db);
    await trainDays(db, 8);
    await refreshSuggestions(db, {
      userId: USER,
      today,
      cycleMode: "none",
      nutritionMode: "off",
    });
    expect(
      (await suggestionsForDay(db, today)).map((r) => r.kind),
    ).not.toContain("safety");
  });

  it("stays quiet when she hardly trains", async () => {
    await lowIntakeAndEnergy(db);
    await trainDays(db, 2);
    await refreshSuggestions(db, {
      userId: USER,
      today,
      cycleMode: "none",
      nutritionMode: "log",
    });
    expect(
      (await suggestionsForDay(db, today)).map((r) => r.kind),
    ).not.toContain("safety");
  });

  it("adds low intake as a signal next to a clearly late period", async () => {
    for (const d of [
      "2026-06-01",
      "2026-06-29",
      "2026-07-27",
      "2026-08-24",
      "2026-09-21",
    ])
      await saveCycleEvent(db, USER, "period_start", d);
    for (let i = 1; i <= 12; i++)
      for (const name of ["a", "b"])
        await addQuickEntry(db, {
          day: addDays(today, -i),
          meal: null,
          name,
          kcal: 450,
          proteinG: null,
        });
    await saveCheckin(db, USER, today, values(3, 3, 3));
    await refreshSuggestions(db, {
      userId: USER,
      today,
      cycleMode: "natural",
      nutritionMode: "log_no_totals",
    });
    const safety = (await suggestionsForDay(db, today)).find(
      (r) => r.kind === "safety",
    );
    expect(safety?.params).toMatchObject({ lowIntake: true });
  });

  it("the signature changes when food entries change, only while nutrition is on", async () => {
    const off = await engineSignature(db, today, false, "off");
    const on = await engineSignature(db, today, false, "log");
    await addQuickEntry(db, {
      day: today,
      meal: null,
      name: "x",
      kcal: 100,
      proteinG: null,
    });
    expect(await engineSignature(db, today, false, "off")).toBe(off);
    expect(await engineSignature(db, today, false, "log")).not.toBe(on);
  });
});

describe("refreshSuggestions: hunger note", () => {
  const hungerValues = (hunger: number) => ({ ...values(3, 3, 3), hunger });
  async function risingHunger(target: LocalDb) {
    for (let i = 1; i <= 34; i++)
      await saveCheckin(
        target,
        USER,
        addDays(today, -i),
        hungerValues(i <= 6 ? 4 : 2),
      );
    await saveCheckin(target, USER, today, hungerValues(4));
  }
  async function trainDays(target: LocalDb, days: number) {
    const was = db;
    db = target;
    for (let i = 1; i <= days; i++)
      await benchSession(addDays(today, -i), 60, 5);
    db = was;
  }

  it("raises a note when hunger rose and she trains regularly, for every cycle mode and without nutrition logging", async () => {
    for (const cycleMode of ["none", "hormonal", "natural", null] as const) {
      const target = createLocalDb(`hunger-${++n}`);
      await risingHunger(target);
      await trainDays(target, 6);
      await refreshSuggestions(target, {
        userId: USER,
        today,
        cycleMode,
        nutritionMode: "off",
      });
      const kinds = (await suggestionsForDay(target, today)).map((r) => r.kind);
      expect(kinds, String(cycleMode)).toContain("hunger_note");
    }
  });

  it("stays quiet without regular training", async () => {
    await risingHunger(db);
    await trainDays(db, 2);
    await refreshSuggestions(db, { userId: USER, today });
    expect(
      (await suggestionsForDay(db, today)).map((r) => r.kind),
    ).not.toContain("hunger_note");
  });

  it("a note that was shown and then removed the same day does not come back the next day", async () => {
    await risingHunger(db);
    await trainDays(db, 6);
    await refreshSuggestions(db, { userId: USER, today });
    expect((await suggestionsForDay(db, today)).map((r) => r.kind)).toContain(
      "hunger_note",
    );
    for (let i = 0; i <= 6; i++)
      await saveCheckin(db, USER, addDays(today, -i), hungerValues(2));
    await refreshSuggestions(db, { userId: USER, today });
    expect(
      (await suggestionsForDay(db, today)).map((r) => r.kind),
    ).not.toContain("hunger_note");
    // tomorrow the rise shows again, but the 28-day rest still holds
    const tomorrow = addDays(today, 1);
    for (let i = 0; i <= 6; i++)
      await saveCheckin(db, USER, addDays(tomorrow, -i), hungerValues(4));
    await refreshSuggestions(db, { userId: USER, today: tomorrow });
    expect(
      (await suggestionsForDay(db, tomorrow)).map((r) => r.kind),
    ).not.toContain("hunger_note");
  });

  it("does not depend on weight or food entries", async () => {
    const withData = createLocalDb(`hunger-extra-${++n}`);
    for (const target of [db, withData]) {
      await risingHunger(target);
      await trainDays(target, 6);
    }
    await saveWeight(withData, USER, addDays(today, -1), 64);
    await addQuickEntry(withData, {
      day: today,
      meal: null,
      name: "x",
      kcal: 300,
      proteinG: null,
    });
    const options = {
      userId: USER,
      today,
      cycleMode: "none" as const,
      nutritionMode: "log" as const,
    };
    await refreshSuggestions(db, options);
    await refreshSuggestions(withData, options);
    const note = async (target: LocalDb) =>
      (await suggestionsForDay(target, today)).find(
        (r) => r.kind === "hunger_note",
      )?.params;
    expect(await note(db)).toBeDefined();
    expect(await note(withData)).toEqual(await note(db));
  });

  it("reads no weight or food rows when both are switched off", async () => {
    await risingHunger(db);
    await trainDays(db, 6);
    await saveWeight(db, USER, addDays(today, -1), 64);
    await addQuickEntry(db, {
      day: today,
      meal: null,
      name: "x",
      kcal: 500,
      proteinG: null,
    });
    const reads: string[] = [];
    db.foods.hook("reading", (o) => (reads.push("foods"), o));
    db.food_logs.hook("reading", (o) => (reads.push("food_logs"), o));
    db.bodyweight_entries.hook("reading", (o) => (reads.push("weight"), o));
    await refreshSuggestions(db, {
      userId: USER,
      today,
      cycleMode: "none",
      nutritionMode: "off",
      hideWeight: true,
    });
    expect(reads).toEqual([]);
  });

  it("removes today's note when the data no longer supports it", async () => {
    await risingHunger(db);
    await trainDays(db, 6);
    await refreshSuggestions(db, { userId: USER, today });
    expect((await suggestionsForDay(db, today)).map((r) => r.kind)).toContain(
      "hunger_note",
    );
    for (let i = 0; i <= 6; i++)
      await saveCheckin(db, USER, addDays(today, -i), hungerValues(2));
    await refreshSuggestions(db, { userId: USER, today });
    expect(
      (await suggestionsForDay(db, today)).map((r) => r.kind),
    ).not.toContain("hunger_note");
  });
});
