import { round1 } from "@/lib/math";
// Pure helpers for food entries. Values are only ever what the person entered
// or scanned: nothing is estimated, and missing values stay missing.

export interface FoodValues {
  name: string;
  basis: "100g" | "portion";
  portionG: number | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface EntryValues {
  nameSnapshot: string;
  amountG: number | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export type Validated<T> =
  { ok: true; value: T } | { ok: false; error: string };

const MAX_AMOUNT_G = 3000;
const MAX_ENTRY_KCAL = 10000;
const MAX_ENTRY_G = 1000;
const MAX_FOOD_G = 500;
const MAX_KCAL_PER_100G = 900;
const MAX_KCAL_PER_PORTION = 5000;

const orNull = (n: number | null) => (n === null ? null : round1(n));
const isNum = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const within = (n: number | null, min: number, max: number) =>
  n === null || (isNum(n) && n >= min && n <= max);

type Amount = { grams: number } | { portions: number };

// Scales a food to what was eaten: grams for per-100 g foods, portions for
// per-portion foods. Returns null for an unusable amount.
export function entryFromFood(
  food: FoodValues,
  amount: Amount,
): EntryValues | null {
  let factor: number;
  let grams: number | null;
  if (food.basis === "100g") {
    if (!("grams" in amount) || !isNum(amount.grams)) return null;
    if (amount.grams <= 0 || amount.grams > MAX_AMOUNT_G) return null;
    factor = amount.grams / 100;
    grams = amount.grams;
  } else {
    if (!("portions" in amount) || !isNum(amount.portions)) return null;
    if (amount.portions <= 0 || amount.portions > 50) return null;
    factor = amount.portions;
    grams =
      food.portionG !== null ? round1(food.portionG * amount.portions) : null;
  }
  const scale = (v: number | null) => (v === null ? null : round1(v * factor));
  const entry: EntryValues = {
    nameSnapshot: food.name,
    amountG: grams,
    kcal: scale(food.kcal),
    proteinG: scale(food.proteinG),
    carbsG: scale(food.carbsG),
    fatG: scale(food.fatG),
  };
  // The scaled result must stay inside the same limits the database enforces,
  // otherwise it would be saved locally and then rejected on sync.
  if (
    !within(entry.kcal, 0, MAX_ENTRY_KCAL) ||
    !within(entry.proteinG, 0, MAX_ENTRY_G) ||
    !within(entry.carbsG, 0, MAX_ENTRY_G) ||
    !within(entry.fatG, 0, MAX_ENTRY_G) ||
    !within(entry.amountG, 0, MAX_AMOUNT_G)
  )
    return null;
  return entry;
}

export interface QuickEntry {
  name: string;
  kcal: number | null;
  proteinG: number | null;
}

export function validateQuickEntry(input: QuickEntry): Validated<QuickEntry> {
  const name = input.name.trim();
  if (name.length > 80) return { ok: false, error: "Der Name ist zu lang." };
  if (input.kcal === null && input.proteinG === null)
    return { ok: false, error: "Trage Kalorien oder Eiweiß ein." };
  if (!within(input.kcal, 0, MAX_ENTRY_KCAL))
    return { ok: false, error: "Die Kalorien sehen nicht plausibel aus." };
  if (!within(input.proteinG, 0, MAX_ENTRY_G))
    return { ok: false, error: "Das Eiweiß sieht nicht plausibel aus." };
  return {
    ok: true,
    value: {
      name,
      kcal: orNull(input.kcal),
      proteinG: orNull(input.proteinG),
    },
  };
}

export function validateFood(input: FoodValues): Validated<FoodValues> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80)
    return { ok: false, error: "Bitte gib einen Namen ein (bis 80 Zeichen)." };
  if (input.kcal === null && input.proteinG === null)
    return { ok: false, error: "Trage Kalorien oder Eiweiß ein." };
  if (
    input.basis === "portion" &&
    (input.portionG === null || !within(input.portionG, 0.1, 2000))
  )
    return { ok: false, error: "Bitte gib die Portionsgröße in Gramm an." };
  const maxKcal =
    input.basis === "100g" ? MAX_KCAL_PER_100G : MAX_KCAL_PER_PORTION;
  if (!within(input.kcal, 0, maxKcal))
    return { ok: false, error: "Die Kalorien sehen nicht plausibel aus." };
  for (const v of [input.proteinG, input.carbsG, input.fatG])
    if (!within(v, 0, MAX_FOOD_G))
      return { ok: false, error: "Ein Nährwert sieht nicht plausibel aus." };
  return {
    ok: true,
    value: {
      ...input,
      name,
      portionG: orNull(input.portionG),
      kcal: orNull(input.kcal),
      proteinG: orNull(input.proteinG),
      carbsG: orNull(input.carbsG),
      fatG: orNull(input.fatG),
    },
  };
}

export interface DayTotals {
  kcal: number;
  proteinG: number;
  entries: number;
  /** At least one entry has calories (a protein-only day is not "0 kcal"). */
  hasKcal: boolean;
}

export function dayTotals(
  logs: {
    kcal: number | null;
    protein_g: number | null;
    deleted_at: string | null;
  }[],
): DayTotals {
  const live = logs.filter((l) => !l.deleted_at);
  return {
    kcal: Math.round(live.reduce((s, l) => s + (l.kcal ?? 0), 0)),
    proteinG: Math.round(live.reduce((s, l) => s + (l.protein_g ?? 0), 0)),
    entries: live.length,
    hasKcal: live.some((l) => l.kcal !== null),
  };
}
