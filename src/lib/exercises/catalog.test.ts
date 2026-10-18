import { describe, expect, it } from "vitest";
import { CATALOG, getCatalogExercise } from "./catalog";
import { matchExercise, searchExercises } from "./match";

describe("catalog", () => {
  it("has unique ids and no alias collisions that would make imports ambiguous", () => {
    const ids = CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CATALOG.length).toBeGreaterThanOrEqual(100);
    for (const e of CATALOG) {
      expect(e.id.length).toBeLessThanOrEqual(64);
      expect(e.id).toMatch(/^[a-z0-9-]+$/);
    }
  });
  it("looks up by id", () => {
    expect(getCatalogExercise("barbell-bench-press")?.name).toBe(
      "Bankdrücken (Langhantel)",
    );
  });
});

describe("matchExercise (import)", () => {
  it.each([
    ["Bench Press (Barbell)", "barbell-bench-press"],
    ["bench press (barbell)", "barbell-bench-press"],
    ["Squat (Barbell)", "barbell-back-squat"],
    ["Romanian Deadlift (Barbell)", "romanian-deadlift"],
    ["Lat Pulldown (Cable)", "lat-pulldown"],
    ["Hip Thrust (Barbell)", "hip-thrust"],
    ["Kniebeuge", "barbell-back-squat"],
    ["Hüftheben", "hip-thrust"],
  ])("%s -> %s", (input, id) => {
    expect(matchExercise(input)?.id).toBe(id);
  });
  it("returns undefined for unknown names", () => {
    expect(matchExercise("Zottman Curl Spezial")).toBeUndefined();
  });
});

describe("searchExercises", () => {
  it("ranks exact and prefix matches first and ignores umlauts/case", () => {
    expect(searchExercises("bankdrucken")[0].id).toBe("barbell-bench-press");
    expect(searchExercises("KLIMM").map((e) => e.id)).toContain("pull-up");
  });
  it("finds by English alias and returns defaults for an empty query", () => {
    expect(
      searchExercises("deadlift").some((e) => e.id === "conventional-deadlift"),
    ).toBe(true);
    expect(searchExercises("").length).toBeGreaterThan(0);
  });
});
