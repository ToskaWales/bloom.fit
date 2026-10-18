import { describe, expect, it } from "vitest";
import { weightTrend } from "./weight";

describe("weightTrend", () => {
  it("returns nothing for no entries and the value itself for a single one", () => {
    expect(weightTrend([])).toEqual([]);
    expect(weightTrend([{ day: "2026-10-01", kg: 62 }])).toEqual([
      { day: "2026-10-01", kg: 62, trend: 62 },
    ]);
  });

  it("smooths day-to-day noise but follows a real change", () => {
    const noisy = [62, 63.2, 61.6, 62.8, 62.1, 63, 61.9, 62.5].map((kg, i) => ({
      day: `2026-10-0${i + 1}`,
      kg,
    }));
    const t = weightTrend(noisy);
    const trends = t.map((p) => p.trend);
    expect(Math.max(...trends) - Math.min(...trends)).toBeLessThan(1);
    // a sustained +3 kg shift over four weeks shows up in the trend
    const rising = Array.from({ length: 28 }, (_, i) => ({
      day: `2026-10-${String(i + 1).padStart(2, "0")}`,
      kg: 62 + (3 * i) / 27,
    }));
    const end = weightTrend(rising).at(-1)!;
    expect(end.trend).toBeGreaterThan(63.5);
    expect(end.trend).toBeLessThan(end.kg + 0.01);
  });

  it("weights gaps: a long break lets the next value count for more", () => {
    const dense = weightTrend([
      { day: "2026-10-01", kg: 60 },
      { day: "2026-10-02", kg: 64 },
    ]);
    const gap = weightTrend([
      { day: "2026-10-01", kg: 60 },
      { day: "2026-10-22", kg: 64 },
    ]);
    expect(gap[1].trend).toBeGreaterThan(dense[1].trend);
  });

  it("sorts unordered input and keeps one value per day (last wins)", () => {
    const t = weightTrend([
      { day: "2026-10-03", kg: 62 },
      { day: "2026-10-01", kg: 60 },
      { day: "2026-10-01", kg: 61 },
    ]);
    expect(t.map((p) => p.day)).toEqual(["2026-10-01", "2026-10-03"]);
    expect(t[0].kg).toBe(61);
  });
});
