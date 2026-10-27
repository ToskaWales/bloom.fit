// Looks up catalog exercises by name: exact match for the CSV importers and a
// ranked search for the exercise picker. The data itself is ./catalog; unmatched
// names are not handled here (importers turn them into custom exercises).
import { CATALOG, type CatalogExercise } from "./catalog";

/** Comparison key: lower case, no accents or punctuation, "ß" as "ss", single spaces. */
export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// normalized name/id/alias -> exercise; the first catalog entry wins on a clash.
const index = new Map<string, CatalogExercise>();
for (const ex of CATALOG) {
  for (const label of [ex.name, ex.id.replaceAll("-", " "), ...ex.aliases]) {
    const key = normalizeName(label);
    if (key && !index.has(key)) index.set(key, ex);
  }
}

// Exact (normalized) match on name, id or alias. Used by the CSV importers;
// unmatched names become custom exercises, so nothing is silently lost.
export function matchExercise(name: string): CatalogExercise | undefined {
  return index.get(normalizeName(name));
}

// Simple ranked search for the exercise picker: exact name, then prefix, word
// prefix, substring, then all words contained. Empty query returns the first entries.
export function searchExercises(query: string, limit = 30): CatalogExercise[] {
  const q = normalizeName(query);
  if (!q) return CATALOG.slice(0, limit);
  const scored: [number, CatalogExercise][] = [];
  for (const ex of CATALOG) {
    const labels = [ex.name, ...ex.aliases].map(normalizeName);
    let score = 0;
    if (labels.some((l) => l === q)) score = 100;
    else if (labels.some((l) => l.startsWith(q))) score = 80;
    else if (labels.some((l) => l.split(" ").some((w) => w.startsWith(q))))
      score = 60;
    else if (labels.some((l) => l.includes(q))) score = 40;
    else if (q.split(" ").every((t) => labels.some((l) => l.includes(t))))
      score = 30;
    if (score) scored.push([score, ex]);
  }
  return scored
    .sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, "de"))
    .slice(0, limit)
    .map(([, e]) => e);
}
