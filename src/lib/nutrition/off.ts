import { round1 } from "@/lib/math";
// Turns an Open Food Facts product into plain per-100 g values. Nothing but
// energy, protein, carbs, fat, name and brand is taken: no images, no scores.

export interface OffFood {
  name: string;
  brand: string | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export type OffResult =
  { ok: true; food: OffFood } | { ok: false; reason: "not_found" | "unusable" };

const MAX_KCAL_PER_100G = 900;
const MAX_G_PER_100G = 100;
const MACRO_TOLERANCE_G = 2;
const KJ_PER_KCAL = 4.184;

function amount(v: unknown): number | null {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && /^\s*\d+([.,]\d+)?\s*$/.test(v)
        ? Number(v.replace(",", "."))
        : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

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
