// Pins down personal-record detection: only against earlier history, ties do not
// count, and warm-up or unfinished sets are ignored.
import { describe, expect, it } from "vitest";
import { findPRs } from "./prs";

const set = (
  id: string,
  weight: number | null,
  reps: number | null,
  over = {},
) => ({
  id,
  set_type: "normal",
  weight_kg: weight,
  reps,
  completed: true,
  deleted_at: null,
  ...over,
});

describe("findPRs", () => {
  const history = [set("h1", 60, 8), set("h2", 70, 3)]; // best weight 70, best e1RM 77 (70×3)

  it("flags a heavier set and a better estimated 1RM, only against earlier history", () => {
    const result = findPRs(history, [set("c1", 72.5, 3)]);
    expect(result.get("c1")).toEqual(["weight", "e1rm"]);
  });

  it("flags e1RM without a weight PR (more reps at a lower weight)", () => {
    const result = findPRs(history, [set("c1", 65, 10)]); // e1RM 86.7 > 77, weight 65 < 70
    expect(result.get("c1")).toEqual(["e1rm"]);
  });

  it("does not flag ties or lower performance", () => {
    expect(findPRs(history, [set("c1", 70, 3)]).size).toBe(0);
    expect(findPRs(history, [set("c1", 50, 5)]).size).toBe(0);
  });

  it("only the first set that reaches a new best is a PR within one workout", () => {
    const result = findPRs(history, [
      set("c1", 75, 3),
      set("c2", 75, 3),
      set("c3", 77.5, 3),
    ]);
    expect([...result.keys()]).toEqual(["c1", "c3"]);
  });

  it("ignores warm-ups, unfinished, deleted and weightless sets", () => {
    const result = findPRs(history, [
      set("w", 100, 5, { set_type: "warmup" }),
      set("u", 100, 5, { completed: false }),
      set("d", 100, 5, { deleted_at: "2026-11-01T00:00:00Z" }),
      set("b", null, 20),
    ]);
    expect(result.size).toBe(0);
  });

  it("gives no PRs on the very first time (no baseline)", () => {
    expect(findPRs([], [set("c1", 100, 5)]).size).toBe(0);
  });

  it("ignores warm-up and unfinished sets when building the baseline", () => {
    const base = [
      set("h", 60, 5),
      set("hw", 200, 5, { set_type: "warmup" }),
      set("hu", 200, 5, { completed: false }),
    ];
    expect(findPRs(base, [set("c", 62.5, 5)]).get("c")).toContain("weight");
  });

  it("does not invent an e1RM baseline when earlier sets were all high-rep", () => {
    const base = [set("h", 40, 20)]; // 20 reps: no reliable e1RM
    const result = findPRs(base, [set("c", 30, 10)]); // lighter and no weight PR
    expect(result.size).toBe(0);
  });
});
