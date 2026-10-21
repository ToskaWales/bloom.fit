import type { DayTotals } from "./calc";

// All wording of the nutrition screens lives here so one test can hold it to
// the rules in CLAUDE.md: no judging, no targets, no streaks, no colour talk.

const de = (n: number) => n.toLocaleString("de-DE");

export const MEAL_LABEL = {
  morning: "Morgens",
  midday: "Mittags",
  evening: "Abends",
  snack: "Zwischendurch",
} as const;

export const NUTRITION_TEXT = {
  title: "Ernährung",
  intro:
    "Trage ein, was du isst, so genau oder so grob du magst. Bloom bewertet nichts und gibt dir kein Tagesziel vor.",
  empty: "Noch nichts eingetragen.",
  quickTitle: "Schnell eintragen",
  quickHint: "Kalorien oder Eiweiß reichen.",
  foodsTitle: "Meine Lebensmittel",
  foodsEmpty:
    "Speichere Lebensmittel mit ihren Werten, dann trägst du sie später mit einem Tipp ein.",
  recentTitle: "Zuletzt",
  offlineNote: "Alles hier funktioniert auch ohne Netz.",
  totalsHidden:
    "Summen sind ausgeblendet. Du kannst das in den Einstellungen ändern.",
  settingsLink: "Ernährung ein- oder ausschalten",
  note: "Die Werte sind das, was du einträgst. Bloom rechnet nichts hinzu und schätzt nichts.",
} as const;

export function totalsLine(t: DayTotals): string {
  if (t.entries === 0) return NUTRITION_TEXT.empty;
  const parts = [`${de(t.kcal)} kcal`];
  if (t.proteinG > 0) parts.push(`${de(t.proteinG)} g Eiweiß`);
  return `Heute eingetragen: ${parts.join(" · ")}`;
}

export function entryLine(e: {
  kcal: number | null;
  protein_g: number | null;
  amount_g: number | null;
}): string {
  const parts: string[] = [];
  if (e.amount_g !== null) parts.push(`${de(e.amount_g)} g`);
  if (e.kcal !== null) parts.push(`${de(Math.round(e.kcal))} kcal`);
  if (e.protein_g !== null) parts.push(`${de(e.protein_g)} g Eiweiß`);
  return parts.join(" · ");
}

// Every fixed sentence, for the wording test.
export function allNutritionTexts(): string[] {
  return [
    ...Object.values(NUTRITION_TEXT),
    ...Object.values(MEAL_LABEL),
    totalsLine({ kcal: 1640, proteinG: 95, entries: 3 }),
    totalsLine({ kcal: 300, proteinG: 0, entries: 1 }),
    totalsLine({ kcal: 0, proteinG: 0, entries: 0 }),
    entryLine({ kcal: 250, protein_g: 12, amount_g: 60 }),
  ];
}
