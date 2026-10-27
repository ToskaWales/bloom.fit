// All fixed German wording of the nutrition screens, kept in one file so the
// wording test (./texts.test.ts) can hold it to the CLAUDE.md rules: no judging,
// no targets, no streaks, no colour talk. Numbers come from ./calc (DayTotals).
import type { DayTotals } from "./calc";

const de = (n: number) => n.toLocaleString("de-DE");

/** Meal slots by time of day. */
export const MEAL_LABEL = {
  morning: "Morgens",
  midday: "Mittags",
  evening: "Abends",
  snack: "Zwischendurch",
} as const;

/** Fixed sentences (screen titles, hints, barcode and camera messages). Add new ones here so the wording test sees them. */
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
  barcodeTitle: "Per Barcode hinzufügen",
  barcodeHint: "Gib die Ziffern ein oder scanne den Strichcode.",
  barcodeSearch: "Suchen",
  barcodeScan: "Kamera starten",
  barcodeScanClose: "Kamera schließen",
  barcodeOffline: "Gerade offline, trag es kurz von Hand ein.",
  barcodeInvalid:
    "Diese Nummer sieht nicht richtig aus. Bitte prüfe die Ziffern.",
  barcodeNotFound:
    "Dieses Produkt kennt Open Food Facts nicht. Du kannst es von Hand eintragen.",
  barcodeUnusable:
    "Zu diesem Produkt gibt es keine brauchbaren Werte. Du kannst es von Hand eintragen.",
  barcodeUpstream:
    "Die Suche klappt gerade nicht. Versuche es später noch einmal oder trag es von Hand ein.",
  barcodeLimited:
    "Du hast gerade viele Produkte gesucht. Bitte warte kurz oder trag es von Hand ein.",
  barcodeLogin: "Bitte melde dich neu an und versuche es noch einmal.",
  barcodeNotAllowed:
    "Die Suche ist gerade nicht freigegeben. Prüfe in den Einstellungen, ob Ernährung eingeschaltet ist.",
  barcodeDismiss: "Verwerfen",
  cameraMissing:
    "Es wurde keine Kamera gefunden. Du kannst die Ziffern eintippen.",
  cameraBusy:
    "Die Kamera wird gerade von etwas anderem genutzt. Du kannst die Ziffern eintippen.",
  scannerLoadFailed:
    "Der Scanner konnte nicht geladen werden. Du kannst die Ziffern eintippen.",
  barcodeOff:
    "Ernährung ist ausgeschaltet. Schalte sie in den Einstellungen ein, um zu suchen.",
  barcodeKnown: "Dieses Produkt hast du schon gespeichert:",
  cameraDenied:
    "Die Kamera ist nicht freigegeben. Du kannst die Ziffern auch eintippen.",
  cameraUnavailable:
    "Auf diesem Gerät ist keine Kamera verfügbar. Du kannst die Ziffern eintippen.",
  cameraHint:
    "Halte den Strichcode ruhig und im Hellen vor die Kamera. Das Bild bleibt auf deinem Gerät.",
  attribution:
    "Daten: Open Food Facts (ODbL), openfoodfacts.org. Prüfe die Werte, bevor du speicherst.",
  note: "Die Werte sind das, was du einträgst. Bloom rechnet nichts hinzu und schätzt nichts.",
} as const;

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
  });

// A plain statement of what was entered; no comparison, no target.
export function totalsLine(t: DayTotals, day?: string, today?: string): string {
  if (t.entries === 0) return NUTRITION_TEXT.empty;
  const parts: string[] = [];
  if (t.hasKcal) parts.push(`${de(t.kcal)} kcal`);
  if (t.proteinG > 0) parts.push(`${de(t.proteinG)} g Eiweiß`);
  const when =
    day && today && day !== today
      ? `Am ${dayLabel(day)} eingetragen`
      : "Heute eingetragen";
  return `${when}: ${parts.join(" · ")}`;
}

/** One entry as "60 g · 250 kcal · 12 g Eiweiß", leaving out unknown values. */
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

// Every fixed sentence plus sample generated ones, for the wording test.
export function allNutritionTexts(): string[] {
  return [
    ...Object.values(NUTRITION_TEXT),
    ...Object.values(MEAL_LABEL),
    totalsLine({ kcal: 1640, proteinG: 95, entries: 3, hasKcal: true }),
    totalsLine({ kcal: 300, proteinG: 0, entries: 1, hasKcal: true }),
    totalsLine({ kcal: 0, proteinG: 30, entries: 1, hasKcal: false }),
    totalsLine(
      { kcal: 300, proteinG: 0, entries: 1, hasKcal: true },
      "2026-10-20",
      "2026-10-21",
    ),
    totalsLine({ kcal: 0, proteinG: 0, entries: 0, hasKcal: false }),
    entryLine({ kcal: 250, protein_g: 12, amount_g: 60 }),
  ];
}
