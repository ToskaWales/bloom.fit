import { describe, expect, it } from "vitest";
import {
  dayTotals,
  entryFromFood,
  validateFood,
  validateQuickEntry,
  type FoodValues,
} from "./calc";

const oats: FoodValues = {
  name: "Haferflocken",
  basis: "100g",
  portionG: null,
  kcal: 370,
  proteinG: 13.5,
  carbsG: 59,
  fatG: 7,
};
const bar: FoodValues = {
  name: "Riegel",
  basis: "portion",
  portionG: 45,
  kcal: 190,
  proteinG: 20,
  carbsG: null,
  fatG: null,
};

describe("entryFromFood", () => {
  it("scales per-100 g values to the eaten amount and rounds to one decimal", () => {
    expect(entryFromFood(oats, { grams: 60 })).toMatchObject({
      amountG: 60,
      kcal: 222,
      proteinG: 8.1,
      carbsG: 35.4,
      fatG: 4.2,
      nameSnapshot: "Haferflocken",
    });
  });
  it("multiplies per-portion values by the number of portions", () => {
    expect(entryFromFood(bar, { portions: 1.5 })).toMatchObject({
      amountG: 67.5,
      kcal: 285,
      proteinG: 30,
      carbsG: null,
    });
  });
  it("keeps missing values missing instead of inventing zeros", () => {
    const e = entryFromFood({ ...oats, kcal: null }, { grams: 100 });
    expect(e?.kcal).toBeNull();
    expect(e?.proteinG).toBe(13.5);
  });
  it("rejects a result that would break the entry limits (typo like 2000 g of nut butter)", () => {
    const butter: FoodValues = {
      ...oats,
      name: "Nussmus",
      kcal: 600,
      proteinG: 25,
    };
    expect(entryFromFood(butter, { grams: 200 })).not.toBeNull();
    expect(entryFromFood(butter, { grams: 2000 })).toBeNull(); // 12,000 kcal
    expect(
      entryFromFood({ ...bar, portionG: 250 }, { portions: 13 }),
    ).toBeNull(); // 3,250 g
    expect(
      entryFromFood({ ...oats, kcal: null, proteinG: 60 }, { grams: 2000 }),
    ).toBeNull(); // 1,200 g protein
  });
  it("rejects non-positive or absurd amounts", () => {
    expect(entryFromFood(oats, { grams: 0 })).toBeNull();
    expect(entryFromFood(oats, { grams: -5 })).toBeNull();
    expect(entryFromFood(oats, { grams: 5000 })).toBeNull();
    expect(entryFromFood(bar, { portions: 0 })).toBeNull();
    expect(entryFromFood(bar, { grams: 50 })).toBeNull(); // portion foods are counted in portions
    expect(entryFromFood(oats, { portions: 1 })).toBeNull();
  });
});

describe("validateQuickEntry", () => {
  it("accepts energy and/or protein and trims the name", () => {
    expect(
      validateQuickEntry({ name: "  Mittag ", kcal: 650, proteinG: null }),
    ).toEqual({
      ok: true,
      value: { name: "Mittag", kcal: 650, proteinG: null },
    });
    expect(validateQuickEntry({ name: "", kcal: null, proteinG: 30 }).ok).toBe(
      true,
    );
  });
  it("rounds to one decimal like the database stores them", () => {
    expect(
      validateQuickEntry({ name: "", kcal: 100.26, proteinG: 12.345 }),
    ).toEqual({
      ok: true,
      value: { name: "", kcal: 100.3, proteinG: 12.3 },
    });
  });
  it("needs at least one value and keeps both inside plausible limits", () => {
    expect(
      validateQuickEntry({ name: "x", kcal: null, proteinG: null }).ok,
    ).toBe(false);
    expect(validateQuickEntry({ name: "x", kcal: -1, proteinG: null }).ok).toBe(
      false,
    );
    expect(
      validateQuickEntry({ name: "x", kcal: 10001, proteinG: null }).ok,
    ).toBe(false);
    expect(
      validateQuickEntry({ name: "x", kcal: null, proteinG: 1001 }).ok,
    ).toBe(false);
    expect(
      validateQuickEntry({ name: "x".repeat(81), kcal: 1, proteinG: null }).ok,
    ).toBe(false);
    expect(
      validateQuickEntry({ name: "x", kcal: Number.NaN, proteinG: null }).ok,
    ).toBe(false);
  });
});

describe("validateFood", () => {
  it("applies the database limits (900 kcal per 100 g, portion size needed for portions)", () => {
    expect(validateFood(oats).ok).toBe(true);
    expect(validateFood({ ...oats, kcal: 950 }).ok).toBe(false);
    expect(validateFood({ ...bar, kcal: 1200 }).ok).toBe(true);
    expect(validateFood({ ...bar, portionG: null }).ok).toBe(false);
    expect(validateFood({ ...oats, name: " " }).ok).toBe(false);
    expect(validateFood({ ...oats, kcal: null, proteinG: null }).ok).toBe(
      false,
    );
    expect(validateFood({ ...oats, fatG: 501 }).ok).toBe(false);
  });
});

describe("dayTotals", () => {
  it("sums what was entered, ignores deleted entries and counts nothing for missing values", () => {
    expect(
      dayTotals([
        { kcal: 300, protein_g: 20, deleted_at: null },
        { kcal: 450.5, protein_g: null, deleted_at: null },
        { kcal: 999, protein_g: 99, deleted_at: "2026-10-02T10:00:00Z" },
      ]),
    ).toEqual({ kcal: 751, proteinG: 20, entries: 2, hasKcal: true });
  });
  it("reports whether any entry had calories, so a protein-only day is not shown as zero calories", () => {
    expect(
      dayTotals([{ kcal: null, protein_g: 30, deleted_at: null }]),
    ).toEqual({
      kcal: 0,
      proteinG: 30,
      entries: 1,
      hasKcal: false,
    });
    expect(
      dayTotals([{ kcal: 0, protein_g: 30, deleted_at: null }]).hasKcal,
    ).toBe(true);
  });
  it("is empty for no entries", () => {
    expect(dayTotals([])).toEqual({
      kcal: 0,
      proteinG: 0,
      entries: 0,
      hasKcal: false,
    });
  });
});
