import { describe, expect, it } from "vitest";
import { normaliseOffProduct } from "./off";

const product = (
  nutriments: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => ({
  status: 1,
  product: {
    product_name: "Haferflocken",
    brands: "Kölln, Andere",
    nutriments,
    ...extra,
  },
});

describe("normaliseOffProduct", () => {
  it("reads per-100 g values and the first brand", () => {
    expect(
      normaliseOffProduct(
        product({
          "energy-kcal_100g": 372,
          proteins_100g: 13.5,
          carbohydrates_100g: 58.7,
          fat_100g: 7,
        }),
      ),
    ).toEqual({
      ok: true,
      food: {
        name: "Haferflocken",
        brand: "Kölln",
        kcal: 372,
        proteinG: 13.5,
        carbsG: 58.7,
        fatG: 7,
      },
    });
  });
  it("converts kJ when kcal is missing and accepts numbers given as strings", () => {
    const r = normaliseOffProduct(
      product({ "energy-kj_100g": "1569", proteins_100g: "13,5" }),
    );
    expect(r).toMatchObject({ ok: true, food: { kcal: 375, proteinG: 13.5 } });
    expect(
      normaliseOffProduct(product({ energy_100g: 1569, proteins_100g: 1 })),
    ).toMatchObject({
      food: { kcal: 375 },
    });
  });
  it("keeps missing values missing and drops negative, NaN and implausible ones", () => {
    const r = normaliseOffProduct(
      product({
        "energy-kcal_100g": 120,
        proteins_100g: -3,
        carbohydrates_100g: "abc",
        fat_100g: 600,
      }),
    );
    expect(r).toEqual({
      ok: true,
      food: {
        name: "Haferflocken",
        brand: "Kölln",
        kcal: 120,
        proteinG: null,
        carbsG: null,
        fatG: null,
      },
    });
    expect(
      normaliseOffProduct(
        product({ "energy-kcal_100g": 950, proteins_100g: 5 }),
      ),
    ).toMatchObject({
      food: { kcal: null, proteinG: 5 },
    });
  });
  it("drops all macros when they add up to more than 100 g", () => {
    const r = normaliseOffProduct(
      product({
        "energy-kcal_100g": 400,
        proteins_100g: 50,
        carbohydrates_100g: 40,
        fat_100g: 30,
      }),
    );
    expect(r).toMatchObject({
      food: { kcal: 400, proteinG: null, carbsG: null, fatG: null },
    });
  });
  it("rounds to one decimal", () => {
    expect(
      normaliseOffProduct(
        product({ "energy-kcal_100g": 100.26, proteins_100g: 12.345 }),
      ),
    ).toMatchObject({
      food: { kcal: 100.3, proteinG: 12.3 },
    });
  });
  it("prefers the German name, strips control characters and shortens to 80 characters", () => {
    const r = normaliseOffProduct(
      product(
        { "energy-kcal_100g": 1 },
        { product_name_de: ` Hafer\u0000‮ flocken ${"x".repeat(100)}` },
      ),
    );
    expect(r.ok && r.food.name.length).toBe(80);
    expect(r.ok && r.food.name.startsWith("Hafer flocken")).toBe(true);
    expect(r.ok && /[\u0000-\u001f‮]/.test(r.food.name)).toBe(false);
  });
  it("says 'not found' for status 0 and 'unusable' without energy and protein", () => {
    expect(normaliseOffProduct({ status: 0 })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(normaliseOffProduct(null)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(normaliseOffProduct("<html>")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(normaliseOffProduct(product({ carbohydrates_100g: 10 }))).toEqual({
      ok: false,
      reason: "unusable",
    });
    expect(normaliseOffProduct(product({}, { product_name: "" }))).toEqual({
      ok: false,
      reason: "unusable",
    });
  });
  it("uses a placeholder name when the product has none but values exist", () => {
    const r = normaliseOffProduct({
      status: 1,
      product: { nutriments: { "energy-kcal_100g": 50 } },
    });
    expect(r).toMatchObject({
      ok: true,
      food: { name: "Produkt", brand: null },
    });
  });
});
