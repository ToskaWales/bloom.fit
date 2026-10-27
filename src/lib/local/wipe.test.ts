// Pins down logout/account-deletion cleanup: unsynced changes are counted before, and every local Bloom database is gone after. Protects the next person on a shared device.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { createLocalDb } from "./db";
import { saveRow } from "./repo";
import { unsyncedChanges, wipeLocalData } from "./wipe";

describe("local data wipe (logout / account deletion)", () => {
  it("counts unsynced changes across all bloom databases and deletes them all", async () => {
    const a = createLocalDb("bloom-user-a");
    const b = createLocalDb("bloom-user-b");
    const other = new Dexie("somebody-else");
    other.version(1).stores({ x: "id" });
    await other.open();

    await saveRow(a, "workouts", {
      id: "11111111-1111-4111-8111-111111111111",
      title: null,
      started_at: "2026-11-01T10:00:00.000Z",
      ended_at: null,
      notes: null,
      source: "app",
      deleted_at: null,
    });
    await saveRow(b, "custom_exercises", {
      id: "22222222-2222-4222-8222-222222222222",
      name: "X",
      muscle_group: null,
      equipment: null,
      deleted_at: null,
    });
    await saveRow(b, "custom_exercises", {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Y",
      muscle_group: null,
      equipment: null,
      deleted_at: null,
    });
    a.close();
    b.close();

    expect(await unsyncedChanges()).toBe(3);

    await wipeLocalData();
    const names = await Dexie.getDatabaseNames();
    expect(names).not.toContain("bloom-user-a");
    expect(names).not.toContain("bloom-user-b");
    expect(names).toContain("somebody-else"); // not ours: left alone
    expect(await unsyncedChanges()).toBe(0);
  });
});
