// Reine Helfer für das Ernährungs-Log: Skalierung pro 100 g, Summen, Eingabeprüfung.

export type Macros = { kcal: number; proteinG: number; carbsG: number; fatG: number };

export type FoodDraft = {
  name: string;
  quantityG: string;
  /** Nährwerte pro 100 g als Text (Komma oder Punkt) */
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

export type FoodErrors = Partial<Record<keyof FoodDraft, 'required' | 'invalid' | 'range'>>;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Werte pro 100 g auf die Menge hochrechnen. */
export function scaleMacros(per100: Macros, quantityG: number): Macros {
  const f = quantityG / 100;
  return {
    kcal: round1(per100.kcal * f),
    proteinG: round1(per100.proteinG * f),
    carbsG: round1(per100.carbsG * f),
    fatG: round1(per100.fatG * f),
  };
}

/** Umkehrung: aus gespeicherten Gesamtwerten die Werte pro 100 g (für „Zuletzt gegessen"). */
export function per100FromTotals(totals: Macros, quantityG: number | null): Macros {
  const q = quantityG && quantityG > 0 ? quantityG : 100;
  const f = 100 / q;
  return {
    kcal: round1(totals.kcal * f),
    proteinG: round1(totals.proteinG * f),
    carbsG: round1(totals.carbsG * f),
    fatG: round1(totals.fatG * f),
  };
}

export function sumMacros(items: Macros[]): Macros {
  const total = items.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return {
    kcal: round1(total.kcal),
    proteinG: round1(total.proteinG),
    carbsG: round1(total.carbsG),
    fatG: round1(total.fatG),
  };
}

/** Brennwert aus Makros (4/4/9 kcal pro g) – nur als Komfort, wenn kcal nicht angegeben wurde. */
export function kcalFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return round1(proteinG * 4 + carbsG * 4 + fatG * 9);
}

function parseNonNegative(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

export const FOOD_LIMITS = {
  maxQuantityG: 5000,
  maxKcalPer100: 1000,
  maxMacroPer100: 100,
} as const;

export type ParsedFood = { name: string; quantityG: number; per100: Macros };

/**
 * Prüft die Eingabe. Leere Makros zählen als 0. Ist kcal leer, wird er aus den Makros berechnet
 * (mindestens ein Makro muss dann angegeben sein).
 */
export function parseFoodDraft(
  draft: FoodDraft,
): { ok: true; value: ParsedFood } | { ok: false; errors: FoodErrors } {
  const errors: FoodErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) errors.name = 'required';
  else if (name.length > 200) errors.name = 'range';

  const quantityG = parseNonNegative(draft.quantityG);
  if (draft.quantityG.trim() === '') errors.quantityG = 'required';
  else if (quantityG === null) errors.quantityG = 'invalid';
  else if (quantityG <= 0 || quantityG > FOOD_LIMITS.maxQuantityG) errors.quantityG = 'range';

  const macro = (field: 'proteinG' | 'carbsG' | 'fatG'): number => {
    if (draft[field].trim() === '') return 0;
    const value = parseNonNegative(draft[field]);
    if (value === null) errors[field] = 'invalid';
    else if (value > FOOD_LIMITS.maxMacroPer100) errors[field] = 'range';
    return value ?? 0;
  };
  const proteinG = macro('proteinG');
  const carbsG = macro('carbsG');
  const fatG = macro('fatG');
  if (proteinG + carbsG + fatG > 100 && !errors.proteinG && !errors.carbsG && !errors.fatG) {
    errors.fatG = 'range'; // mehr als 100 g Makros auf 100 g Lebensmittel ist nicht möglich
  }

  let kcal: number;
  if (draft.kcal.trim() === '') {
    kcal = kcalFromMacros(proteinG, carbsG, fatG);
    if (kcal === 0 && !errors.proteinG && !errors.carbsG && !errors.fatG) errors.kcal = 'required';
  } else {
    const parsed = parseNonNegative(draft.kcal);
    if (parsed === null) errors.kcal = 'invalid';
    else if (parsed > FOOD_LIMITS.maxKcalPer100) errors.kcal = 'range';
    kcal = parsed ?? 0;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { name, quantityG: quantityG as number, per100: { kcal, proteinG, carbsG, fatG } },
  };
}

/** Wie oft dasselbe Lebensmittel (Name, ohne Groß-/Kleinschreibung) vorkommt: neuester Eintrag gewinnt. */
export function dedupeRecent<T extends { name: string }>(entriesNewestFirst: T[], limit = 12): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of entriesNewestFirst) {
    const key = entry.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}
