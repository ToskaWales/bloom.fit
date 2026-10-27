// Pins down the 1RM estimate, set volume and summary: which sets count as working
// sets, and when the estimate is too unreliable to give.
import { describe, expect, it } from "vitest";
import { estimateOneRepMax, setVolume, summarize } from "./stats";

describe("estimateOneRepMax (Epley)", () => {
  it("returns the weight for a single and scales with reps", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.3, 1);
  });
  it("returns null for missing or unusable input and caps very high reps", () => {
    expect(estimateOneRepMax(null, 5)).toBeNull();
    expect(estimateOneRepMax(60, 0)).toBeNull();
    expect(estimateOneRepMax(60, 40)).toBeNull();
  });
});

describe("setVolume / summarize", () => {
  const sets = [
    {
      set_type: "warmup",
      weight_kg: 20,
      reps: 10,
      completed: true,
      deleted_at: null,
    },
    {
      set_type: "normal",
      weight_kg: 60,
      reps: 8,
      completed: true,
      deleted_at: null,
    },
    {
      set_type: "normal",
      weight_kg: 60,
      reps: 8,
      completed: false,
      deleted_at: null,
    },
    {
      set_type: "normal",
      weight_kg: 60,
      reps: 8,
      completed: true,
      deleted_at: "2026-11-01T00:00:00Z",
    },
    {
      set_type: "failure",
      weight_kg: 55,
      reps: 10,
      completed: true,
      deleted_at: null,
    },
    {
      set_type: "normal",
      weight_kg: null,
      reps: 12,
      completed: true,
      deleted_at: null,
    },
  ];
  it("counts only completed, non-deleted working sets with weight and reps", () => {
    expect(setVolume(sets[0])).toBe(0); // warmup
    expect(setVolume(sets[1])).toBe(480);
    expect(setVolume(sets[2])).toBe(0); // not completed
    expect(setVolume(sets[3])).toBe(0); // deleted
    expect(setVolume(sets[5])).toBe(0); // bodyweight without load
    expect(summarize(sets)).toEqual({ workingSets: 3, volumeKg: 480 + 550 });
  });
});
