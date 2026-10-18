import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/daily/day";
import { summarizeCycle } from "@/lib/daily/cycle";
import { evaluateSafety } from "./safety";

const today = "2026-10-30";
const start = (day: string) => ({ kind: "period_start" as const, day });
// regular 28-day cycles, last start 2026-09-21: expected ~10-19, window to 10-21
const regular = [
  "2026-06-01",
  "2026-06-29",
  "2026-07-27",
  "2026-08-24",
  "2026-09-21",
].map(start);
const cycleAt = (d: string) => summarizeCycle(regular, d);

const energy = (value: number, days = 14) =>
  Array.from({ length: days }, (_, i) => ({
    day: addDays(today, -i),
    energy: value,
  }));
const weights = (kgs: number[]) =>
  kgs.map((kg, i) => ({ day: addDays(today, -(kgs.length - 1 - i) * 3), kg }));

describe("evaluateSafety", () => {
  it("is quiet while the period is on time, whatever else happens", () => {
    const r = evaluateSafety({
      today: "2026-10-18",
      cycle: cycleAt("2026-10-18"),
      checkins: energy(1),
      weights: weights([64, 63, 62, 61, 60]),
    });
    expect(r).toMatchObject({ active: false });
  });

  it("needs the period to be at least a week beyond the usual window", () => {
    const sixDays = "2026-10-27"; // window ended 10-21 -> 6 days
    expect(
      evaluateSafety({
        today: sixDays,
        cycle: cycleAt(sixDays),
        checkins: energy(1),
        weights: null,
      }).active,
    ).toBe(false);
    const sevenDays = "2026-10-28";
    expect(
      evaluateSafety({
        today: sevenDays,
        cycle: cycleAt(sevenDays),
        checkins: energy(1),
        weights: null,
      }),
    ).toMatchObject({ active: true, overdueDays: 7 });
  });

  it("is quiet when the period is late but nothing else points the same way", () => {
    const r = evaluateSafety({
      today,
      cycle: cycleAt(today),
      checkins: energy(3),
      weights: weights([62, 62.2, 61.9, 62.1, 62]),
    });
    expect(r.active).toBe(false);
  });

  it("is active when the period is clearly late and energy has been low for two weeks", () => {
    const r = evaluateSafety({
      today,
      cycle: cycleAt(today),
      checkins: energy(2),
      weights: null,
    });
    expect(r).toMatchObject({
      active: true,
      lowEnergy: true,
      weightFall: false,
    });
  });

  it("is active when the period is late and the weight trend fell quickly", () => {
    const r = evaluateSafety({
      today,
      cycle: cycleAt(today),
      checkins: energy(3),
      weights: weights([64, 63.4, 62.8, 62.2, 61.6, 61]),
    });
    expect(r).toMatchObject({
      active: true,
      weightFall: true,
      lowEnergy: false,
    });
  });

  it("ignores weight completely when it is hidden", () => {
    const r = evaluateSafety({
      today,
      cycle: cycleAt(today),
      checkins: energy(3),
      weights: null,
    });
    expect(r).toMatchObject({ active: false, weightFall: false });
  });

  it("needs enough low-energy check-ins and enough weigh-ins to judge", () => {
    expect(
      evaluateSafety({
        today,
        cycle: cycleAt(today),
        checkins: energy(1, 5),
        weights: null,
      }).lowEnergy,
    ).toBe(false);
    expect(
      evaluateSafety({
        today,
        cycle: cycleAt(today),
        checkins: energy(3),
        weights: weights([64, 61]),
      }).weightFall,
    ).toBe(false);
  });

  it("does not treat a stale last start or missing cycle data as an overdue period", () => {
    const stale = summarizeCycle(regular, "2026-12-30");
    expect(
      evaluateSafety({
        today: "2026-12-30",
        cycle: stale,
        checkins: energy(1),
        weights: null,
      }).active,
    ).toBe(false);
    expect(
      evaluateSafety({
        today,
        cycle: summarizeCycle([], today),
        checkins: energy(1),
        weights: null,
      }).active,
    ).toBe(false);
  });
});
