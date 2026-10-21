import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { pushSchemas } from "@/lib/sync/tables";
import { createLocalDb, type LocalDb } from "./db";
import {
  addFoodEntry,
  addQuickEntry,
  copyEntryTo,
  deleteEntry,
  deleteFood,
  findFoodByBarcode,
  listFoods,
  logsForDay,
  recentEntries,
  saveFood,
  setFavorite,
} from "./nutrition";
import type { FoodLogRow, FoodRow } from "./types";

let db: LocalDb;
let n = 0;
beforeEach(() => {
  db = createLocalDb(`nut-${++n}`);
});
const day = "2026-10-20";

const oats = {
  name: "Haferflocken",
  basis: "100g" as const,
  portionG: null,
  kcal: 370,
  proteinG: 13.5,
  carbsG: 59,
  fatG: 7,
};

describe("quick entries", () => {
  it("stores a valid, sync-ready entry and queues it", async () => {
    const r = await addQuickEntry(db, {
      day,
      meal: "midday",
      name: " Mittag ",
      kcal: 650,
      proteinG: null,
    });
    expect(r.ok).toBe(true);
    const [row] = await logsForDay(db, day);
    expect(row).toMatchObject({
      day,
      meal: "midday",
      name_snapshot: "Mittag",
      kcal: 650,
      protein_g: null,
      food_id: null,
    });
    expect(pushSchemas.food_logs.safeParse(row).success).toBe(true);
    expect(await db.outbox.count()).toBe(1);
  });
  it("rejects invalid input without writing", async () => {
    const r = await addQuickEntry(db, {
      day,
      meal: null,
      name: "x",
      kcal: null,
      proteinG: null,
    });
    expect(r.ok).toBe(false);
    expect(await db.food_logs.count()).toBe(0);
  });
  it("allows several entries on the same day", async () => {
    await addQuickEntry(db, {
      day,
      meal: null,
      name: "a",
      kcal: 100,
      proteinG: null,
    });
    await addQuickEntry(db, {
      day,
      meal: null,
      name: "b",
      kcal: 100,
      proteinG: null,
    });
    expect(await logsForDay(db, day)).toHaveLength(2);
  });
});

describe("foods", () => {
  it("saves a food (valid for sync), lists favorites first, then by name", async () => {
    const a = await saveFood(db, oats);
    const b = await saveFood(db, {
      ...oats,
      name: "Apfel",
      kcal: 52,
      proteinG: 0.3,
      carbsG: 14,
      fatG: 0.2,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(pushSchemas.foods.safeParse(a.value).success).toBe(true);
    expect((await listFoods(db)).map((f) => f.name)).toEqual([
      "Apfel",
      "Haferflocken",
    ]);
    await setFavorite(db, a.value.id, true);
    expect((await listFoods(db)).map((f) => f.name)).toEqual([
      "Haferflocken",
      "Apfel",
    ]);
  });
  it("rejects an invalid food and a duplicate barcode", async () => {
    expect((await saveFood(db, { ...oats, kcal: 950 })).ok).toBe(false);
    expect((await saveFood(db, oats, { barcode: "4001234567890" })).ok).toBe(
      true,
    );
    const dup = await saveFood(
      db,
      { ...oats, name: "Andere" },
      { barcode: "4001234567890" },
    );
    expect(dup.ok).toBe(false);
    expect((await saveFood(db, oats, { barcode: "abc" })).ok).toBe(false);
  });
  it("a deleted food disappears from the list but past entries keep their numbers", async () => {
    const f = await saveFood(db, oats);
    if (!f.ok) throw new Error("setup");
    const e = await addFoodEntry(
      db,
      f.value,
      { grams: 50 },
      { day, meal: "morning" },
    );
    expect(e.ok).toBe(true);
    await deleteFood(db, f.value.id);
    expect(await listFoods(db)).toHaveLength(0);
    const [row] = await logsForDay(db, day);
    expect(row).toMatchObject({
      name_snapshot: "Haferflocken",
      kcal: 185,
      food_id: f.value.id,
    });
  });
});

describe("food entries", () => {
  it("scales the food to the eaten amount", async () => {
    const f = await saveFood(db, oats);
    if (!f.ok) throw new Error("setup");
    await addFoodEntry(db, f.value, { grams: 60 }, { day, meal: null });
    const [row] = (await logsForDay(db, day)) as FoodLogRow[];
    expect(row).toMatchObject({ amount_g: 60, kcal: 222, protein_g: 8.1 });
    expect(pushSchemas.food_logs.safeParse(row).success).toBe(true);
  });
  it("rejects a bad amount without writing", async () => {
    const f = (await saveFood(db, oats)) as { ok: true; value: FoodRow };
    expect(
      (await addFoodEntry(db, f.value, { grams: 0 }, { day, meal: null })).ok,
    ).toBe(false);
    expect(await db.food_logs.count()).toBe(0);
  });
  it("deleting an entry is a soft delete that is queued for sync", async () => {
    await addQuickEntry(db, {
      day,
      meal: null,
      name: "a",
      kcal: 100,
      proteinG: null,
    });
    const [row] = await logsForDay(db, day);
    await deleteEntry(db, row.id);
    expect(await logsForDay(db, day)).toHaveLength(0);
    expect((await db.food_logs.get(row.id)) as FoodLogRow).toMatchObject({
      deleted_at: expect.any(String),
    });
    expect(await db.outbox.count()).toBe(2);
  });
});

describe("recent entries", () => {
  it("lists distinct recent entries (newest first) and copies one to another day", async () => {
    await addQuickEntry(db, {
      day: "2026-10-18",
      meal: null,
      name: "Skyr",
      kcal: 120,
      proteinG: 20,
    });
    await addQuickEntry(db, {
      day: "2026-10-18",
      meal: null,
      name: "Skyr",
      kcal: 120,
      proteinG: 20,
    });
    await addQuickEntry(db, {
      day: "2026-10-19",
      meal: null,
      name: "Brot",
      kcal: 200,
      proteinG: null,
    });
    const recent = await recentEntries(db, day);
    expect(recent.map((r) => r.name_snapshot)).toEqual(["Brot", "Skyr"]);
    await copyEntryTo(db, recent[1].id, { day, meal: "snack" });
    const [copy] = await logsForDay(db, day);
    expect(copy).toMatchObject({
      name_snapshot: "Skyr",
      kcal: 120,
      protein_g: 20,
      meal: "snack",
      day,
    });
    expect(copy.id).not.toBe(recent[1].id);
  });
  it("ignores deleted entries and entries older than 30 days", async () => {
    await addQuickEntry(db, {
      day: "2026-08-01",
      meal: null,
      name: "Alt",
      kcal: 100,
      proteinG: null,
    });
    await addQuickEntry(db, {
      day: "2026-10-19",
      meal: null,
      name: "Weg",
      kcal: 100,
      proteinG: null,
    });
    const [gone] = await logsForDay(db, "2026-10-19");
    await deleteEntry(db, gone.id);
    expect(await recentEntries(db, day)).toEqual([]);
  });
});

describe("findFoodByBarcode", () => {
  it("finds a saved food by barcode, ignores deleted ones and unknown codes", async () => {
    const f = await saveFood(db, oats, {
      barcode: "4006381333931",
      source: "off",
    });
    if (!f.ok) throw new Error("setup");
    expect((await findFoodByBarcode(db, "4006381333931"))?.id).toBe(f.value.id);
    expect(await findFoodByBarcode(db, "40170725")).toBeUndefined();
    await deleteFood(db, f.value.id);
    expect(await findFoodByBarcode(db, "4006381333931")).toBeUndefined();
  });
  it("stores source and brand from a lookup", async () => {
    const f = await saveFood(db, oats, {
      barcode: "4006381333931",
      source: "off",
      brand: "Kölln",
    });
    expect(f.ok && f.value).toMatchObject({
      source: "off",
      brand: "Kölln",
      barcode: "4006381333931",
    });
    expect(f.ok && pushSchemas.foods.safeParse(f.value).success).toBe(true);
  });
  it("rejects a brand that is too long", async () => {
    expect((await saveFood(db, oats, { brand: "x".repeat(81) })).ok).toBe(
      false,
    );
  });
});

describe("barcode forms and double saves", () => {
  it("finds a food saved as EAN-13 when the scanner reports the 12-digit UPC-A", async () => {
    const f = await saveFood(db, oats, { barcode: "0036000291452" });
    expect(f.ok).toBe(true);
    expect((await findFoodByBarcode(db, "036000291452"))?.name).toBe(
      "Haferflocken",
    );
    const dup = await saveFood(db, oats, { barcode: "036000291452" });
    expect(dup.ok).toBe(false);
  });
  it("two saves at the same moment create only one food per barcode", async () => {
    const [a, b] = await Promise.all([
      saveFood(db, oats, { barcode: "4006381333931" }),
      saveFood(db, oats, { barcode: "4006381333931" }),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(await db.foods.count()).toBe(1);
  });
});
