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
    const res = await runSync(db, U, {
      push: { workouts: [workout()] },
      cursors: {},
    });
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
});
