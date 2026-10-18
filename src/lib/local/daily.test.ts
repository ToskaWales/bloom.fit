import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { pushSchemas } from "@/lib/sync/tables";
import { createLocalDb, type LocalDb } from "./db";
import {
  getCheckin,
  removeCycleEvent,
  removeWeight,
  saveCheckin,
  saveCycleEvent,
  saveWeight,
} from "./daily";
import type { CheckinRow, CycleEventRow, WeightRow } from "./types";

const USER = "11111111-aaaa-4aaa-8aaa-111111111111";
let db: LocalDb;
let n = 0;
beforeEach(() => {
  db = createLocalDb(`daily-${++n}`);
});

const values = {
  sleepQuality: 4,
  sleepHours: 7.5,
  energy: 3,
  motivation: 5,
  hunger: 2,
  symptoms: ["cramps" as const],
  note: null,
};

describe("check-ins", () => {
  it("creates one row per day with a stable id that passes the sync schema", async () => {
    await saveCheckin(db, USER, "2026-10-02", values);
    await saveCheckin(db, USER, "2026-10-02", { ...values, energy: 4 });
    const rows = (await db.checkins.toArray()) as CheckinRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      day: "2026-10-02",
      energy: 4,
      sleep_quality: 4,
      symptoms: ["cramps"],
    });
    expect(pushSchemas.checkins.safeParse(rows[0]).success).toBe(true);
    expect(await getCheckin(db, USER, "2026-10-02")).toMatchObject({
      energy: 4,
    });
  });

  it("queues every save for sync and uses different rows for different days and users", async () => {
    await saveCheckin(db, USER, "2026-10-02", values);
    await saveCheckin(db, USER, "2026-10-03", values);
    expect(await db.checkins.count()).toBe(2);
    expect(await db.outbox.count()).toBe(2);
    const other = createLocalDb(`daily-other-${n}`);
    await saveCheckin(
      other,
      "22222222-bbbb-4bbb-8bbb-222222222222",
      "2026-10-02",
      values,
    );
    expect((await other.checkins.toArray())[0].id).not.toBe(
      (await db.checkins.toArray())[0].id,
    );
  });

  it("revives a day whose check-in was deleted instead of creating a second row", async () => {
    await saveCheckin(db, USER, "2026-10-02", values);
    const row = (await db.checkins.toArray())[0];
    await db.checkins.put({ ...row, deleted_at: "2026-10-03T00:00:00.000Z" });
    expect(await getCheckin(db, USER, "2026-10-02")).toBeUndefined();
    await saveCheckin(db, USER, "2026-10-02", values);
    expect(await db.checkins.count()).toBe(1);
    expect(
      ((await db.checkins.get(row.id)) as CheckinRow).deleted_at,
    ).toBeNull();
  });
});

describe("weight", () => {
  it("keeps one entry per day (the latest) and can remove it", async () => {
    await saveWeight(db, USER, "2026-10-02", 62.4);
    await saveWeight(db, USER, "2026-10-02", 62.1);
    const rows = (await db.bodyweight_entries.toArray()) as WeightRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0].weight_kg).toBe(62.1);
    expect(pushSchemas.bodyweight_entries.safeParse(rows[0]).success).toBe(
      true,
    );
    await removeWeight(db, USER, "2026-10-02");
    expect(
      ((await db.bodyweight_entries.toArray())[0] as WeightRow).deleted_at,
    ).not.toBeNull();
  });
});

describe("cycle events", () => {
  it("logs and removes events idempotently per kind and day", async () => {
    await saveCycleEvent(db, USER, "period_start", "2026-10-05");
    await saveCycleEvent(db, USER, "period_start", "2026-10-05");
    await saveCycleEvent(db, USER, "period_end", "2026-10-05");
    const rows = (await db.cycle_events.toArray()) as CycleEventRow[];
    expect(rows).toHaveLength(2);
    for (const r of rows)
      expect(pushSchemas.cycle_events.safeParse(r).success).toBe(true);
    await removeCycleEvent(db, USER, "period_start", "2026-10-05");
    const active = (await db.cycle_events.toArray()).filter(
      (r) => !r.deleted_at,
    );
    expect(active).toHaveLength(1);
    // re-adding the same event brings the same row back
    await saveCycleEvent(db, USER, "period_start", "2026-10-05");
    expect(await db.cycle_events.count()).toBe(2);
    expect(
      (await db.cycle_events.toArray()).filter((r) => !r.deleted_at),
    ).toHaveLength(2);
  });
});
