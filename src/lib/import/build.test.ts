// Pins down the import into the local database: idempotent re-imports, no resurrection
// of deleted workouts, user-scoped ids and rows the sync server will accept.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalDb, type LocalDb } from "@/lib/local/db";
import { saveRow, softDelete } from "@/lib/local/repo";
import { syncOnce, type Fetcher } from "@/lib/sync/client";
import { runSync } from "@/lib/sync/server";
import { memoryDb } from "@/lib/sync/test-helpers";
import { pushSchemas, syncRequestSchema, TABLES } from "@/lib/sync/tables";
import { deterministicUuid, runImport } from "./build";
import { parseCsv } from "./csv";
import { parseHevy, type ImportedWorkout } from "./parsers";

const USER = "11111111-aaaa-4aaa-8aaa-111111111111";
let db: LocalDb;
let n = 0;
beforeEach(() => {
  db = createLocalDb(`imp-${++n}`);
});

const workout = (over: Partial<ImportedWorkout> = {}): ImportedWorkout => ({
  source: "hevy",
  sourceKey: "Push A|21 Oct 2025, 18:30",
  title: "Push A",
  startedAt: "2025-10-21T16:30:00.000Z",
  endedAt: "2025-10-21T17:25:00.000Z",
  notes: "Gut",
  exercises: [
    {
      name: "Bench Press (Barbell)",
      sets: [
        { type: "warmup", weightKg: 40, reps: 10, rpe: null },
        { type: "normal", weightKg: 60, reps: 8, rpe: 8.5 },
      ],
    },
    {
      name: "Zottman Curl Spezial",
      sets: [{ type: "normal", weightKg: 12, reps: 10, rpe: null }],
    },
  ],
  ...over,
});

describe("deterministicUuid", () => {
  it("is stable, distinct per input and a valid uuid for the sync schema", async () => {
    const a = await deterministicUuid("x");
    expect(await deterministicUuid("x")).toBe(a);
    expect(await deterministicUuid("y")).not.toBe(a);
    expect(pushSchemas.workouts.shape.id.safeParse(a).success).toBe(true);
  });
});

describe("runImport", () => {
  it("writes workouts, exercises and sets, matching catalog names and creating custom ones", async () => {
    const r = await runImport(db, USER, [workout()]);
    expect(r).toMatchObject({
      imported: 1,
      skippedExisting: 0,
      sets: 3,
      customExercises: 1,
    });

    const ws = await db.workouts.toArray();
    expect(ws[0]).toMatchObject({
      title: "Push A",
      source: "hevy",
      notes: "Gut",
    });
    const exs = (await db.workout_exercises.toArray()).sort(
      (a, b) => (a.position as number) - (b.position as number),
    );
    expect(exs.map((e) => e.exercise_id)).toEqual([
      "barbell-bench-press",
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    ]);
    const custom = await db.custom_exercises.toArray();
    expect(custom.map((c) => c.name)).toEqual(["Zottman Curl Spezial"]);
    expect(exs[1].exercise_id).toBe(custom[0].id);
    const sets = (await db.workout_sets.toArray())
      .filter((s) => s.workout_exercise_id === exs[0].id)
      .sort((a, b) => (a.position as number) - (b.position as number));
    expect(
      sets.map((s) => [s.set_type, s.weight_kg, s.reps, s.rpe, s.completed]),
    ).toEqual([
      ["warmup", 40, 10, null, true],
      ["normal", 60, 8, 8.5, true],
    ]);
  });

  it("is idempotent: importing the same file twice adds nothing", async () => {
    await runImport(db, USER, [workout()]);
    const outboxAfterFirst = await db.outbox.count();
    const counts = [
      await db.workouts.count(),
      await db.workout_sets.count(),
      await db.custom_exercises.count(),
    ];
    const again = await runImport(db, USER, [workout()]);
    expect(again).toMatchObject({ imported: 0, skippedExisting: 1, sets: 0 });
    expect([
      await db.workouts.count(),
      await db.workout_sets.count(),
      await db.custom_exercises.count(),
    ]).toEqual(counts);
    expect(await db.outbox.count()).toBe(outboxAfterFirst);
  });

  it("does not resurrect a workout the user deleted after importing it", async () => {
    await runImport(db, USER, [workout()]);
    const w = (await db.workouts.toArray())[0];
    await softDelete(db, "workouts", w.id);
    expect(await runImport(db, USER, [workout()])).toMatchObject({
      imported: 0,
      skippedExisting: 1,
    });
  });

  it("reuses an existing custom exercise with the same name", async () => {
    const id = "99999999-9999-4999-8999-999999999999";
    await saveRow(db, "custom_exercises", {
      id,
      name: "zottman curl spezial",
      muscle_group: null,
      equipment: null,
      deleted_at: null,
    });
    const r = await runImport(db, USER, [workout()]);
    expect(r.customExercises).toBe(0);
    expect(
      (await db.workout_exercises.toArray()).some((e) => e.exercise_id === id),
    ).toBe(true);
  });

  it("produces only rows the sync server accepts (sizes, ids, ordering)", async () => {
    const long = workout({ title: "T".repeat(300), notes: "N".repeat(5000) });
    await runImport(db, USER, [
      long,
      workout({
        sourceKey: "Push A|23 Oct 2025, 18:30",
        startedAt: "2025-10-23T16:30:00.000Z",
        endedAt: "2025-10-23T16:30:00.000Z",
      }),
    ]);
    for (const t of TABLES) {
      for (const row of await db[t].toArray()) {
        const parsed = pushSchemas[t].safeParse(row);
        expect(parsed.success, `${t}: ${JSON.stringify(row)}`).toBe(true);
      }
    }
    const server = memoryDb();
    const fetcher: Fetcher = async (_u, init) =>
      new Response(
        JSON.stringify(
          await runSync(
            server.db,
            "u",
            syncRequestSchema.parse(JSON.parse(init.body as string)),
          ),
        ),
        { status: 200 },
      );
    const res = await syncOnce(db, fetcher);
    expect(res).toMatchObject({ status: "ok" });
    expect(await db.meta.get("rejected")).toBeUndefined();
    expect(server.rows.workouts).toHaveLength(2);
    expect(server.rows.workout_sets).toHaveLength(6);
  });

  it("imports a parsed Hevy file end to end and reports progress", async () => {
    const csv = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push A","21 Oct 2025, 18:30","21 Oct 2025, 19:25","","Bench Press (Barbell)","","","0","normal","60","8","","",""
"Pull B","23 Oct 2025, 07:05","23 Oct 2025, 08:00","","Lat Pulldown (Cable)","","","0","normal","50","10","","",""
`;
    const progress: number[] = [];
    const r = await runImport(db, USER, parseHevy(parseCsv(csv)).workouts, {
      chunkSize: 1,
      onProgress: (done) => progress.push(done),
    });
    expect(r.imported).toBe(2);
    expect(progress).toEqual([1, 2]);
  });

  it("derives different ids for different users (no collisions on the server)", async () => {
    const other = createLocalDb(`imp-other-${n}`);
    await runImport(db, USER, [workout()]);
    await runImport(other, "22222222-bbbb-4bbb-8bbb-222222222222", [workout()]);
    const ids = async (d: LocalDb) =>
      [
        ...(await d.workouts.toArray()),
        ...(await d.workout_sets.toArray()),
        ...(await d.custom_exercises.toArray()),
      ].map((r) => r.id);
    const [a, b] = [await ids(db), await ids(other)];
    expect(a.length).toBe(b.length);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });

  it("ids come from the raw export strings, not the timezone-dependent instant", async () => {
    await runImport(db, USER, [
      workout({ startedAt: "2025-10-21T16:30:00.000Z" }),
    ]);
    const other = createLocalDb(`imp-tz-${n}`);
    await runImport(other, USER, [
      workout({ startedAt: "2025-10-21T15:30:00.000Z" }),
    ]); // same file, other timezone
    expect((await other.workouts.toArray())[0].id).toBe(
      (await db.workouts.toArray())[0].id,
    );
  });

  it("does not bring back a custom exercise the user deleted", async () => {
    await runImport(db, USER, [workout()]);
    const c = (await db.custom_exercises.toArray())[0];
    await softDelete(db, "custom_exercises", c.id);
    await runImport(db, USER, [
      workout({
        sourceKey: "Push A|28 Oct 2025, 18:30",
        startedAt: "2025-10-28T16:30:00.000Z",
      }),
    ]);
    expect((await db.custom_exercises.get(c.id))?.deleted_at).not.toBeNull();
  });
});
