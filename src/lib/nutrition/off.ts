// Turns an Open Food Facts product JSON into plain per-100 g values. Takes only
// energy, protein, carbs, fat, name and brand: no images, no scores. Everything
// from outside is treated as untrusted and range-checked. Fetching is
// ./off-fetch; the values later become a saved food (./calc).
import { round1 } from "@/lib/math";
import { MAX_KCAL_PER_100G } from "./calc";

/** A product as we keep it: per 100 g, null where OFF has no usable value. */
export interface OffFood {
  name: string;
  brand: string | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/** not_found: no such product; unusable: neither kcal nor protein could be read. */
export type OffResult =
  { ok: true; food: OffFood } | { ok: false; reason: "not_found" | "unusable" };

// Implausible values from the (crowd-sourced) database are dropped, not corrected.
// 900 kcal per 100 g is about pure fat; macros may sum to 100 g plus 2 g rounding.
const MAX_G_PER_100G = 100;
const MACRO_TOLERANCE_G = 2;
const KJ_PER_KCAL = 4.184;

// A non-negative number from a number or a plain numeric string ("1,5" ok), else null.
function amount(v: unknown): number | null {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && /^\s*\d+([.,]\d+)?\s*$/.test(v)
        ? Number(v.replace(",", "."))
        : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Free text from outside: strips control and invisible direction characters, collapses whitespace, caps length.
function text(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Maps the raw JSON to an OffFood. kcal falls back to kJ / 4.184; if the macros
 * do not add up to a plausible 100 g they are all dropped. Needs kcal or protein,
 * otherwise "unusable". Prefers the German product name.
 */
export function normaliseOffProduct(json: unknown): OffResult {
  if (!isRecord(json) || json.status !== 1 || !isRecord(json.product))
    return { ok: false, reason: "not_found" };
  const p = json.product;
  const n = isRecord(p.nutriments) ? p.nutriments : {};

  let kcal = amount(n["energy-kcal_100g"]);
  if (kcal === null) {
    const kj = amount(n["energy-kj_100g"]) ?? amount(n["energy_100g"]);
    kcal = kj === null ? null : kj / KJ_PER_KCAL;
  }
  if (kcal !== null && kcal > MAX_KCAL_PER_100G) kcal = null;

  const macro = (key: string) => {
    const v = amount(n[key]);
    return v !== null && v <= MAX_G_PER_100G ? v : null;
  };
  let protein = macro("proteins_100g");
  let carbs = macro("carbohydrates_100g");
  let fat = macro("fat_100g");
  const total = (protein ?? 0) + (carbs ?? 0) + (fat ?? 0);
  if (total > MAX_G_PER_100G + MACRO_TOLERANCE_G) {
    protein = null;
    carbs = null;
    fat = null;
  }

  if (kcal === null && protein === null)
    return { ok: false, reason: "unusable" };

  const name = text(p.product_name_de, 80) || text(p.product_name, 80);
  const brand = text(
    typeof p.brands === "string" ? p.brands.split(",")[0] : "",
    80,
  );
  const r = (v: number | null) => (v === null ? null : round1(v));
  return {
    ok: true,
    food: {
      name,
      brand: brand || null,
      kcal: r(kcal),
      proteinG: r(protein),
      carbsG: r(carbs),
      fatG: r(fat),
    },
  };
}
