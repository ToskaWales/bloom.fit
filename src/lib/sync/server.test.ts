// Pins down the server half of sync: validation per row, idempotent upserts, user
// isolation, cursor and 10 s safety-window behaviour, and the row-by-row fallback.
// A bug here means lost, duplicated or skipped health data on some device.
import { describe, expect, it } from "vitest";
import { runSync, SyncRequestError } from "./server";
import { memoryDb } from "./test-helpers";

const U = "u1";
const W = "11111111-1111-4111-8111-111111111111";
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

describe("runSync", () => {
  it("stores pushed rows and returns them with a cursor", async () => {
    const { db } = memoryDb();
    const res = await runSync(
      db,
      U,
      { push: { workouts: [workout()] }, cursors: {} },
      { now: () => new Date("2026-12-01T00:00:00.000Z") },
    );
    expect(res.pulled.workouts).toHaveLength(1);
    expect(res.cursors.workouts).toBe(res.pulled.workouts[0].updated_at);
    expect(res.rejected).toEqual([]);
  });

  it("is idempotent when the same batch is pushed twice", async () => {
    const { db, rows } = memoryDb();
    await runSync(db, U, { push: { workouts: [workout()] }, cursors: {} });
    await runSync(db, U, { push: { workouts: [workout()] }, cursors: {} });
    expect(rows.workouts).toHaveLength(1);
  });

  it("strips server-owned columns a client tries to set", async () => {
    const { db, rows } = memoryDb();
    await runSync(db, U, {
      push: {
        workouts: [
          {
            ...workout(),
            user_id: "attacker",
            updated_at: "1999-01-01T00:00:00.000Z",
          },
        ],
      },
      cursors: {},
    });
    expect(rows.workouts[0].user_id).toBe(U);
    expect(rows.workouts[0].updated_at).not.toBe("1999-01-01T00:00:00.000Z");
  });

  it("rejects invalid rows individually and keeps the valid ones", async () => {
    const { db, rows } = memoryDb();
    const res = await runSync(db, U, {
      push: {
        workouts: [
          workout({ id: "not-a-uuid" }),
          workout({ id: "22222222-2222-4222-8222-222222222222" }),
        ],
      },
      cursors: {},
    });
    expect(res.rejected).toEqual([
      { table: "workouts", id: "not-a-uuid", reason: "invalid" },
    ]);
    expect(rows.workouts).toHaveLength(1);
  });

  it("pulls only the caller's rows and honours the cursor", async () => {
    const { db } = memoryDb();
    await runSync(db, "other", {
      push: {
        workouts: [workout({ id: "33333333-3333-4333-8333-333333333333" })],
      },
      cursors: {},
    });
    const first = await runSync(db, U, {
      push: { workouts: [workout()] },
      cursors: {},
    });
    expect(first.pulled.workouts.map((r) => r.id)).toEqual([W]);
    const again = await runSync(db, U, { push: {}, cursors: first.cursors });
    expect(again.pulled.workouts.map((r) => r.id)).toEqual([W]); // overlap (>=) re-delivers the last row
    await runSync(db, U, {
      push: { workouts: [workout({ title: "Pull" })] },
      cursors: {},
    });
    const later = await runSync(db, U, { push: {}, cursors: first.cursors });
    expect(later.pulled.workouts[0].title).toBe("Pull");
  });

  it("refuses unknown tables and oversized pushes", async () => {
    const { db } = memoryDb();
    await expect(
      runSync(db, U, { push: { profiles: [{}] }, cursors: {} }),
    ).rejects.toBeInstanceOf(SyncRequestError);
    await expect(
      runSync(db, U, { push: {}, cursors: { profiles: null } }),
    ).rejects.toBeInstanceOf(SyncRequestError);
    const many = Array.from({ length: 200 }, () => workout());
    await expect(
      runSync(db, U, {
        push: {
          workouts: many,
          custom_exercises: many,
          workout_exercises: many,
        },
        cursors: {},
      }),
    ).rejects.toBeInstanceOf(SyncRequestError);
  });

  it("flags hasMore when more than a page is available", async () => {
    const { db } = memoryDb();
    const rows = Array.from({ length: 120 }, (_, i) =>
      workout({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }),
    );
    for (let i = 0; i < 520; i += 120) {
      await runSync(db, U, {
        push: { workouts: rows.map((r) => ({ ...r })) },
        cursors: {},
      });
    }
    // only 120 distinct ids exist, so push more distinct ones
    const more = Array.from({ length: 200 }, (_, i) =>
      workout({ id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}` }),
    );
    const more2 = Array.from({ length: 200 }, (_, i) =>
      workout({ id: `20000000-0000-4000-8000-${String(i).padStart(12, "0")}` }),
    );
    await runSync(db, U, { push: { workouts: more }, cursors: {} });
    await runSync(db, U, { push: { workouts: more2 }, cursors: {} });
    const res = await runSync(db, U, { push: {}, cursors: {} });
    expect(res.pulled.workouts).toHaveLength(500);
    expect(res.hasMore).toBe(true);
  });

  it("retries a failed batch row by row so one bad row cannot block the others", async () => {
    const { db } = memoryDb();
    const flaky: typeof db = {
      pull: db.pull,
      async upsert(table, userId, rows) {
        if (rows.some((r) => r.title === "poison")) {
          if (rows.length > 1) throw new Error("batch failed");
          if (rows[0].title === "poison") throw new Error("constraint");
        }
        return db.upsert(table, userId, rows);
      },
    };
    const good = "44444444-4444-4444-8444-444444444444";
    const bad = "55555555-5555-4555-8555-555555555555";
    const res = await runSync(flaky, U, {
      push: {
        workouts: [
          workout({ id: good }),
          workout({ id: bad, title: "poison" }),
        ],
      },
      cursors: {},
    });
    expect(res.rejected).toEqual([
      { table: "workouts", id: bad, reason: "db" },
    ]);
    expect(res.pulled.workouts.map((r) => r.id)).toEqual([good]);
  });

  it("rejects a workout that ends before it starts (mirrors the DB check)", async () => {
    const { db } = memoryDb();
    const res = await runSync(db, U, {
      push: { workouts: [workout({ ended_at: "2026-11-01T09:00:00.000Z" })] },
      cursors: {},
    });
    expect(res.rejected).toHaveLength(1);
  });

  it("holds the cursor back by a safety window so late-committing rows are not skipped", async () => {
    const { db } = memoryDb(); // row timestamps are 2026-11-01T00:00:0N
    await runSync(db, U, { push: { workouts: [workout()] }, cursors: {} });
    const justAfter = new Date("2026-11-01T00:00:03.000Z"); // row is 2s old
    const early = await runSync(
      db,
      U,
      { push: {}, cursors: {} },
      { now: () => justAfter },
    );
    expect(early.pulled.workouts).toHaveLength(1);
    expect(Date.parse(early.cursors.workouts!)).toBeLessThan(
      Date.parse("2026-11-01T00:00:01.000Z"),
    );
    const later = new Date("2026-11-01T01:00:00.000Z");
    const settled = await runSync(
      db,
      U,
      { push: {}, cursors: early.cursors },
      { now: () => later },
    );
    expect(settled.cursors.workouts).toBe(
      settled.pulled.workouts[0].updated_at,
    );
  });

  it("never moves a cursor backwards", async () => {
    const { db } = memoryDb();
    const cursor = "2026-11-01T00:05:00.000Z";
    const res = await runSync(
      db,
      U,
      { push: {}, cursors: { workouts: cursor } },
      { now: () => new Date("2026-11-01T00:05:01.000Z") },
    );
    expect(res.cursors.workouts).toBe(cursor);
  });
});
