import { kcalFromMacros, type Macros } from './nutrition';

export type OffResult =
  | { kind: 'found'; name: string; quantityG: number; per100: Macros }
  | { kind: 'noNutrition'; name: string }
  | { kind: 'notFound' };

const num = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Wandelt eine Open-Food-Facts-Antwort (API v2, `/product/{code}.json`) in unser Format um.
 * Fehlende Makros zählen als 0; fehlt der Brennwert, wird er aus kJ bzw. den Makros berechnet.
 */
export function parseOffProduct(json: unknown): OffResult {
  const body = json as { status?: number; product?: Record<string, unknown> } | null;
  const product = body?.product;
  if (!body || body.status !== 1 || !product) return { kind: 'notFound' };

  const baseName = typeof product.product_name === 'string' ? product.product_name.trim() : '';
  const brand = typeof product.brands === 'string' ? product.brands.split(',')[0]?.trim() : '';
  const name = baseName && brand ? `${baseName} (${brand})` : baseName || brand || '';

  const n = (product.nutriments ?? {}) as Record<string, unknown>;
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = num(n.energy_100g);
    if (kj !== null) kcal = round1(kj / 4.184);
  }

  if (kcal === null && protein === null && carbs === null && fat === null) {
    return { kind: 'noNutrition', name };
  }

  const p = protein ?? 0;
  const c = carbs ?? 0;
  const f = fat ?? 0;
  const serving = num(product.serving_quantity);
  return {
    kind: 'found',
    name,
    quantityG: serving !== null && serving > 0 && serving <= 5000 ? serving : 100,
    per100: { kcal: kcal ?? kcalFromMacros(p, c, f), proteinG: p, carbsG: c, fatG: f },
  };
}
