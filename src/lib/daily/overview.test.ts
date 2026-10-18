import { describe, expect, it } from "vitest";
import { buildOverview } from "./overview";

describe("buildOverview", () => {
  const input = {
    from: "2026-10-01",
    to: "2026-10-05",
    checkins: [
      {
        day: "2026-10-02",
        energy: 4,
        motivation: 3,
        sleep_quality: 5,
        sleep_hours: 7.5,
        hunger: 2,
        symptoms: ["cramps"],
      },
      {
        day: "2026-10-04",
        energy: 2,
        motivation: 2,
        sleep_quality: 2,
        sleep_hours: null,
        hunger: 4,
        symptoms: [],
      },
    ],
    weights: [
      { day: "2026-10-01", kg: 62 },
      { day: "2026-10-03", kg: 62.4 },
    ],
    workouts: [
      { day: "2026-10-02", volumeKg: 5400 },
      { day: "2026-10-02", volumeKg: 600 },
      { day: "2026-10-05", volumeKg: 3000 },
    ],
    periodDays: new Set(["2026-10-01", "2026-10-02"]),
  };
  const o = buildOverview(input);

  it("has one row per day in the window", () => {
    expect(o.map((r) => r.day)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
    ]);
  });
  it("joins check-ins, summed training volume and period days by day", () => {
    expect(o[1]).toMatchObject({
      energy: 4,
      motivation: 3,
      sleepQuality: 5,
      volumeKg: 6000,
      period: true,
    });
    expect(o[0]).toMatchObject({ energy: null, volumeKg: 0, period: true });
    expect(o[2]).toMatchObject({ period: false, energy: null });
  });
  it("carries raw weight and its trend only for days with a weigh-in or after", () => {
    expect(o[0].weightKg).toBe(62);
    expect(o[1].weightKg).toBeNull();
    expect(o[1].weightTrend).not.toBeNull(); // trend continues between weigh-ins
    expect(o[2].weightKg).toBe(62.4);
  });
  it("leaves the weight columns empty when weights are hidden", () => {
    const hidden = buildOverview({ ...input, weights: [] });
    expect(
      hidden.every((r) => r.weightKg === null && r.weightTrend === null),
    ).toBe(true);
  });
});
