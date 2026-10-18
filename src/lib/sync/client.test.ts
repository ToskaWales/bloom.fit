import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalDb, type LocalDb } from "@/lib/local/db";
import { saveRow, softDeleteWorkout } from "@/lib/local/repo";
import { requeueRejected, syncOnce, type Fetcher } from "./client";
import { runSync } from "./server";
import { syncRequestSchema } from "./tables";
import { memoryDb } from "./test-helpers";

const USER = "user-1";
const W = "11111111-1111-4111-8111-111111111111";
const E = "22222222-2222-4222-8222-222222222222";
const S = "33333333-3333-4333-8333-333333333333";

const workout = (over = {}) => ({
  id: W,
  title: "Push",
  started_at: "2026-11-01T10:00:00.000Z",
  ended_at: null,
  notes: null,
  source: "app",
  deleted_at: null,
  ...over,
});
const exercise = () => ({
  id: E,
  workout_id: W,
  exercise_id: "barbell-bench-press",
  position: 0,
  notes: null,
  deleted_at: null,
});
const set = (over = {}) => ({
  id: S,
  workout_exercise_id: E,
  position: 0,
  set_type: "normal",
  weight_kg: 60,
  reps: 8,
  rpe: 8,
  completed: true,
  deleted_at: null,
  ...over,
});

let server: ReturnType<typeof memoryDb>;
let dbA: LocalDb;
let dbB: LocalDb;
let n = 0;

function fetcherFor(
  opts: { failAfterServer?: boolean; status?: number } = {},
): Fetcher {
  return async (_url, init) => {
    if (opts.status) return new Response("{}", { status: opts.status });
    const body = syncRequestSchema.parse(JSON.parse(init.body as string));
    const result = await runSync(server.db, USER, body);
    if (opts.failAfterServer) throw new Error("connection lost");
    return new Response(JSON.stringify(result), { status: 200 });
  };
}

beforeEach(() => {
  server = memoryDb();
  dbA = createLocalDb(`a-${++n}`);
  dbB = createLocalDb(`b-${n}`);
});

async function logWorkoutOffline(db: LocalDb) {
  await saveRow(db, "workouts", workout());
  await saveRow(db, "workout_exercises", exercise());
  await saveRow(db, "workout_sets", set());
}

describe("syncOnce", () => {
  it("pushes offline work, clears the outbox and the data reaches a second device", async () => {
    await logWorkoutOffline(dbA);
    expect(await dbA.outbox.count()).toBe(3);

    const a = await syncOnce(dbA, fetcherFor());
    expect(a).toMatchObject({ status: "ok", pushed: 3 });
    expect(await dbA.outbox.count()).toBe(0);

    await syncOnce(dbB, fetcherFor());
    expect((await dbB.workout_sets.get(S))?.weight_kg).toBe(60);
    expect((await dbB.workouts.get(W))?.title).toBe("Push");
  });

  it("keeps the outbox when the response is lost and a retry does not duplicate anything", async () => {
    await logWorkoutOffline(dbA);
    const lost = await syncOnce(dbA, fetcherFor({ failAfterServer: true }));
    expect(lost.status).toBe("error");
    expect(await dbA.outbox.count()).toBe(3);

    const retry = await syncOnce(dbA, fetcherFor());
    expect(retry.status).toBe("ok");
    expect(await dbA.outbox.count()).toBe(0);
    expect(server.rows.workouts).toHaveLength(1);
    expect(server.rows.workout_sets).toHaveLength(1);
  });

  it("does not overwrite an unsynced local edit with the server copy", async () => {
    await logWorkoutOffline(dbA);
    await syncOnce(dbA, fetcherFor());
    await syncOnce(dbB, fetcherFor());

    // B edits offline; meanwhile A changes the set and syncs
    await saveRow(dbB, "workout_sets", set({ reps: 10 }));
    await saveRow(dbA, "workout_sets", set({ reps: 6 }));
    await syncOnce(dbA, fetcherFor());

    // B pulls first (with its edit still pending): local edit must survive the pull
    const calls: string[] = [];
    const spy: Fetcher = async (u, i) => {
      calls.push(u);
      return fetcherFor()(u, i);
    };
    await syncOnce(dbB, spy);
    // after B's push, last write wins on the server
    expect((await dbB.workout_sets.get(S))?.reps).toBe(10);
    await syncOnce(dbA, fetcherFor());
    expect((await dbA.workout_sets.get(S))?.reps).toBe(10);
  });

  it("propagates soft deletes", async () => {
    await logWorkoutOffline(dbA);
    await syncOnce(dbA, fetcherFor());
    await syncOnce(dbB, fetcherFor());
    await softDeleteWorkout(dbA, W);
    await syncOnce(dbA, fetcherFor());
    await syncOnce(dbB, fetcherFor());
    expect((await dbB.workouts.get(W))?.deleted_at).not.toBeNull();
    expect((await dbB.workout_sets.get(S))?.deleted_at).not.toBeNull();
  });

  it("reports unauthorized and server errors without touching the outbox", async () => {
    await logWorkoutOffline(dbA);
    expect(await syncOnce(dbA, fetcherFor({ status: 401 }))).toEqual({
      status: "unauthorized",
    });
    expect(await syncOnce(dbA, fetcherFor({ status: 500 }))).toMatchObject({
      status: "error",
    });
    expect(await dbA.outbox.count()).toBe(3);
  });

  it("surfaces rows the server rejected instead of silently dropping them", async () => {
    await saveRow(dbA, "workout_sets", set({ weight_kg: 5000 }));
    await saveRow(dbA, "workouts", workout());
    await syncOnce(dbA, fetcherFor());
    const rejected = JSON.parse((await dbA.meta.get("rejected"))!.value!);
    expect(rejected).toEqual([
      { table: "workout_sets", id: S, reason: "invalid" },
    ]);
  });

  it("collapses repeated edits of the same row into one pushed row", async () => {
    await saveRow(dbA, "workouts", workout());
    await saveRow(dbA, "workouts", workout({ title: "Push 2" }));
    await saveRow(dbA, "workouts", workout({ title: "Push 3" }));
    const r = await syncOnce(dbA, fetcherFor());
    expect(r).toMatchObject({ status: "ok", pushed: 1 });
    expect(server.rows.workouts[0].title).toBe("Push 3");
  });

  it("drains more than one batch in several rounds", async () => {
    await saveRow(dbA, "workouts", workout());
    await saveRow(dbA, "workout_exercises", exercise());
    for (let i = 0; i < 450; i++) {
      await saveRow(
        dbA,
        "workout_sets",
        set({
          id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          position: i,
        }),
      );
    }
    const r = await syncOnce(dbA, fetcherFor());
    expect(r).toMatchObject({ status: "ok", pushed: 452 });
    expect(await dbA.outbox.count()).toBe(0);
    expect(server.rows.workout_sets).toHaveLength(450);
  });

  it("keeps rejected rows listed until a later push of the same row succeeds", async () => {
    await saveRow(dbA, "workouts", workout());
    await saveRow(dbA, "workout_sets", set({ weight_kg: 5000 }));
    await syncOnce(dbA, fetcherFor());
    expect(JSON.parse((await dbA.meta.get("rejected"))!.value!)).toHaveLength(
      1,
    );

    // unrelated sync does not clear it
    await saveRow(dbA, "workouts", workout({ title: "Push 2" }));
    await syncOnce(dbA, fetcherFor());
    expect(JSON.parse((await dbA.meta.get("rejected"))!.value!)).toHaveLength(
      1,
    );

    // fixing and re-pushing the row clears it
    await saveRow(dbA, "workout_exercises", exercise());
    await saveRow(dbA, "workout_sets", set({ weight_kg: 60 }));
    await syncOnce(dbA, fetcherFor());
    expect(await dbA.meta.get("rejected")).toBeUndefined();
  });

  it("retries rows the database refused once the cause is gone, but not invalid ones", async () => {
    await saveRow(dbA, "workouts", workout());
    await saveRow(dbA, "workout_exercises", exercise());
    await saveRow(dbA, "workout_sets", set({ weight_kg: 5000 })); // invalid: never retried
    // first sync: the server refuses the workout in the database (simulated)
    const refusing: Fetcher = async (_u, init) => {
      const body = syncRequestSchema.parse(JSON.parse(init.body as string));
      const flaky = {
        pull: server.db.pull,
        upsert: async (
          t: never,
          u: string,
          rows: Record<string, unknown>[],
        ) => {
          if (rows.some((r) => r.id === W)) throw new Error("db says no");
          return server.db.upsert(t, u, rows);
        },
      };
      return new Response(
        JSON.stringify(await runSync(flaky as never, USER, body)),
        { status: 200 },
      );
    };
    await syncOnce(dbA, refusing);
    const rejected = JSON.parse((await dbA.meta.get("rejected"))!.value!);
    expect(rejected.map((r: { reason: string }) => r.reason).sort()).toEqual([
      "db",
      "invalid",
    ]);
    expect(server.rows.workouts ?? []).toHaveLength(0);

    expect(await requeueRejected(dbA)).toBe(1); // only the db-refused one
    await syncOnce(dbA, fetcherFor());
    expect(server.rows.workouts).toHaveLength(1);
    expect(JSON.parse((await dbA.meta.get("rejected"))!.value!)).toHaveLength(
      1,
    ); // the invalid set stays listed
  });
});
