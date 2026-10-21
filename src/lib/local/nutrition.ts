import { addDays } from "@/lib/daily/day";
import {
  entryFromFood,
  validateFood,
  validateQuickEntry,
  type EntryValues,
  type FoodValues,
  type QuickEntry,
  type Validated,
} from "@/lib/nutrition/calc";
import type { LocalDb } from "./db";
import { patchRow, saveRow } from "./repo";
import type { FoodLogRow, FoodRow, Meal } from "./types";

const RECENT_DAYS = 30;
const RECENT_LIMIT = 8;
const BARCODE = /^[0-9]{6,32}$/;

interface Where {
  day: string;
  meal: Meal | null;
}

const failed = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});

async function writeEntry(
  db: LocalDb,
  where: Where,
  entry: EntryValues,
  foodId: string | null,
): Promise<FoodLogRow> {
  const row: FoodLogRow = {
    id: crypto.randomUUID(),
    day: where.day,
    meal: where.meal,
    food_id: foodId,
    name_snapshot: entry.nameSnapshot,
    amount_g: entry.amountG,
    kcal: entry.kcal,
    protein_g: entry.proteinG,
    carbs_g: entry.carbsG,
    fat_g: entry.fatG,
    deleted_at: null,
  };
  await saveRow(db, "food_logs", row);
  return row;
}

export async function addQuickEntry(
  db: LocalDb,
  input: QuickEntry & Where,
): Promise<Validated<FoodLogRow>> {
  const v = validateQuickEntry(input);
  if (!v.ok) return v;
  const row = await writeEntry(
    db,
    input,
    {
      nameSnapshot: v.value.name,
      amountG: null,
      kcal: v.value.kcal,
      proteinG: v.value.proteinG,
      carbsG: null,
      fatG: null,
    },
    null,
  );
  return { ok: true, value: row };
}

export async function addFoodEntry(
  db: LocalDb,
  food: FoodRow,
  amount: { grams: number } | { portions: number },
  where: Where,
): Promise<Validated<FoodLogRow>> {
  const entry = entryFromFood(
    {
      name: food.name,
      basis: food.basis,
      portionG: food.portion_g,
      kcal: food.kcal,
      proteinG: food.protein_g,
      carbsG: food.carbs_g,
      fatG: food.fat_g,
    },
    amount,
  );
  if (!entry) return failed("Die Menge sieht nicht plausibel aus.");
  return { ok: true, value: await writeEntry(db, where, entry, food.id) };
}

export async function logsForDay(
  db: LocalDb,
  day: string,
): Promise<FoodLogRow[]> {
  return (
    (await db.food_logs.where("day").equals(day).toArray()) as FoodLogRow[]
  )
    .filter((l) => !l.deleted_at)
    .sort((a, b) => (a.updated_at ?? "").localeCompare(b.updated_at ?? ""));
}

export async function deleteEntry(db: LocalDb, id: string): Promise<void> {
  await patchRow<FoodLogRow>(db, "food_logs", id, (row) => ({
    ...row,
    deleted_at: row.deleted_at ?? new Date().toISOString(),
  }));
}

export async function saveFood(
  db: LocalDb,
  values: FoodValues,
  options: { barcode?: string; source?: "own" | "off"; brand?: string } = {},
): Promise<Validated<FoodRow>> {
  const v = validateFood(values);
  if (!v.ok) return v;
  if ((options.brand?.trim().length ?? 0) > 80)
    return failed("Die Marke ist zu lang.");
  const barcode = options.barcode ?? null;
  if (barcode !== null) {
    if (!BARCODE.test(barcode))
      return failed("Der Barcode sieht nicht richtig aus.");
    const taken = (
      (await db.foods.where("barcode").equals(barcode).toArray()) as FoodRow[]
    ).some((f) => !f.deleted_at);
    if (taken) return failed("Dieses Produkt hast du schon gespeichert.");
  }
  const row: FoodRow = {
    id: crypto.randomUUID(),
    name: v.value.name,
    brand: options.brand?.trim() || null,
    barcode,
    basis: v.value.basis,
    portion_g: v.value.basis === "portion" ? v.value.portionG : null,
    kcal: v.value.kcal,
    protein_g: v.value.proteinG,
    carbs_g: v.value.carbsG,
    fat_g: v.value.fatG,
    source: options.source ?? "own",
    favorite: false,
    deleted_at: null,
  };
  await saveRow(db, "foods", row);
  return { ok: true, value: row };
}

export async function listFoods(db: LocalDb): Promise<FoodRow[]> {
  return ((await db.foods.toArray()) as FoodRow[])
    .filter((f) => !f.deleted_at)
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        a.name.localeCompare(b.name, "de"),
    );
}

export async function setFavorite(
  db: LocalDb,
  id: string,
  favorite: boolean,
): Promise<void> {
  await patchRow<FoodRow>(db, "foods", id, (row) => ({ ...row, favorite }));
}

export async function deleteFood(db: LocalDb, id: string): Promise<void> {
  await patchRow<FoodRow>(db, "foods", id, (row) => ({
    ...row,
    deleted_at: row.deleted_at ?? new Date().toISOString(),
  }));
}

// Distinct things she ate in the last 30 days (newest first), for one-tap re-logging.
export async function recentEntries(
  db: LocalDb,
  today: string,
): Promise<FoodLogRow[]> {
  const rows = (
    (await db.food_logs
      .where("day")
      .between(addDays(today, -RECENT_DAYS), today, true, true)
      .toArray()) as FoodLogRow[]
  )
    .filter((l) => !l.deleted_at)
    .sort(
      (a, b) =>
        b.day.localeCompare(a.day) ||
        (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
    );
  const seen = new Set<string>();
  const out: FoodLogRow[] = [];
  for (const r of rows) {
    const key = `${r.name_snapshot}|${r.kcal}|${r.protein_g}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length === RECENT_LIMIT) break;
  }
  return out;
}

export async function copyEntryTo(
  db: LocalDb,
  id: string,
  where: Where,
): Promise<void> {
  const src = (await db.food_logs.get(id)) as FoodLogRow | undefined;
  if (!src || src.deleted_at) return;
  await writeEntry(
    db,
    where,
    {
      nameSnapshot: src.name_snapshot,
      amountG: src.amount_g,
      kcal: src.kcal,
      proteinG: src.protein_g,
      carbsG: src.carbs_g,
      fatG: src.fat_g,
    },
    src.food_id,
  );
}

// Withdrawing consent deletes nutrition data on this device too: the entries,
// the foods, anything still waiting to sync, and the hints derived from intake.
export async function wipeNutrition(db: LocalDb): Promise<void> {
  await db.transaction(
    "rw",
    [db.foods, db.food_logs, db.suggestions, db.outbox],
    async () => {
      await db.foods.clear();
      await db.food_logs.clear();
      await db.outbox
        .filter((e) => e.table === "foods" || e.table === "food_logs")
        .delete();
      const derived = (await db.suggestions.toArray()).filter(
        (s) =>
          s.kind === "safety" &&
          s.params &&
          "lowIntake" in (s.params as object),
      );
      for (const s of derived) await db.suggestions.delete(s.id);
    },
  );
}

export async function findFoodByBarcode(
  db: LocalDb,
  barcode: string,
): Promise<FoodRow | undefined> {
  return (
    (await db.foods.where("barcode").equals(barcode).toArray()) as FoodRow[]
  ).find((f) => !f.deleted_at);
}
