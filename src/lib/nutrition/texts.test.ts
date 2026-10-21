import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allNutritionTexts, entryLine, totalsLine } from "./texts";

// No judging, no targets, no streaks, no weight-loss talk, no body-shaming.
const FORBIDDEN: RegExp[] = [
  /zu viel|zu wenig|überschritten|unterschritten/i,
  /ziel erreicht|tagesziel erfüllt|noch \d+ kcal|übrig/i,
  /serie|streak|am stück|in folge/i,
  /gut gemacht|brav|sündig|cheat|verdient|belohn|verbrannt|verbrenn/i,
  /defizit|überschuss|abnehm|diät|zunehm|fett verlieren/i,
  /erlaubt|verboten|gesund|ungesund|clean|schlecht|gut\b/i,
  /optimal|phase|luteal|follikel|cycle[ -]?sync/i,
  /du brauchst|du musst|du solltest/i,
];

describe("nutrition wording", () => {
  it("fixed texts pass the rules", () => {
    for (const text of allNutritionTexts())
      for (const rule of FORBIDDEN)
        expect(text, `${text} vs ${rule}`).not.toMatch(rule);
  });

  it("the daily line is a plain statement with no comparison", () => {
    expect(totalsLine({ kcal: 1640, proteinG: 95, entries: 3 })).toBe(
      "Heute eingetragen: 1.640 kcal · 95 g Eiweiß",
    );
    expect(totalsLine({ kcal: 0, proteinG: 0, entries: 0 })).toBe(
      "Noch nichts eingetragen.",
    );
    expect(entryLine({ kcal: null, protein_g: null, amount_g: null })).toBe("");
  });

  it("the checks themselves catch what they should", () => {
    for (const bad of [
      "Ziel erreicht",
      "Du hast zu viel gegessen",
      "5 Tage in Folge",
      "Gut gemacht",
      "Kalorienüberschuss",
      "gesunde Wahl",
    ])
      expect(
        FORBIDDEN.some((r) => r.test(bad)),
        bad,
      ).toBe(true);
  });
});

// Numbers and entries never use signal colours or status styling.
describe("nutrition components", () => {
  const dir = path.resolve(__dirname, "../../components/nutrition");
  const files = (() => {
    try {
      return readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    } catch {
      return [];
    }
  })();
  it("exist", () => expect(files.length).toBeGreaterThan(0));
  for (const f of files)
    it(`${f} has no red/green/status styling and no progress bars`, () => {
      const src = readFileSync(path.join(dir, f), "utf8");
      expect(src).not.toMatch(
        /\b(red|green|emerald|lime|amber|yellow|orange)-\d/,
      );
      expect(src).not.toMatch(
        /danger|success|warning|<progress|role="progressbar"|role="meter"/i,
      );
    });
});
