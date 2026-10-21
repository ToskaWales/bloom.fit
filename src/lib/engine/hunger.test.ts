import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/daily/day";
import { detectHungerRise, type HungerInput } from "./hunger";

const today = "2026-10-30";
// Hunger ratings: `recent` for the last seven days, `before` for the four weeks before.
const days = (from: number, to: number, value: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    day: addDays(today, -(from + i)),
    hunger: value as number | null,
  }));
const input = (
  recent: number,
  before: number,
  over: Partial<HungerInput> = {},
): HungerInput => ({
  today,
  checkins: [...days(0, 6, recent), ...days(7, 34, before)],
  trainingDays: 6,
  ...over,
});

describe("detectHungerRise", () => {
  it("finds a clear rise over her own earlier level and reports her numbers", () => {
    expect(detectHungerRise(input(4, 2.5 as number))).toMatchObject({
      recent: 4,
      before: 2.5,
      trainingDays: 6,
      perfDrop: null,
    });
  });

  it("needs a rise of at least one point (0.9 is not enough)", () => {
    expect(detectHungerRise(input(3, 2))).not.toBeNull();
    const nearly = {
      ...input(3, 2),
      checkins: [...days(0, 6, 2.9), ...days(7, 34, 2)],
    };
    // a median of 2.9 vs 2 is 0.9
    expect(detectHungerRise(nearly)).toBeNull();
  });

  it("stays quiet when hunger is lower or the same", () => {
    expect(detectHungerRise(input(2, 4))).toBeNull();
    expect(detectHungerRise(input(3, 3))).toBeNull();
  });

  it("needs enough ratings, both recently and before", () => {
    const fewRecent = {
      ...input(4, 2),
      checkins: [...days(0, 2, 4), ...days(7, 34, 2)],
    };
    expect(detectHungerRise(fewRecent)).toBeNull(); // 3 recent values
    const fewBefore = {
      ...input(4, 2),
      checkins: [...days(0, 6, 4), ...days(7, 14, 2)],
    };
    expect(detectHungerRise(fewBefore)).toBeNull(); // 8 earlier values
    const enough = {
      ...input(4, 2),
      checkins: [...days(0, 3, 4), ...days(7, 16, 2)],
    };
    expect(detectHungerRise(enough)).not.toBeNull(); // 4 and 10 values
  });

  it("ignores missing ratings and days after today", () => {
    const withGaps = {
      ...input(4, 2),
      checkins: [
        ...input(4, 2).checkins,
        { day: addDays(today, 1), hunger: 1 },
        { day: addDays(today, -2), hunger: null },
      ],
    };
    expect(detectHungerRise(withGaps)).not.toBeNull();
  });

  it("needs regular training (four days in two weeks)", () => {
    expect(detectHungerRise(input(4, 2, { trainingDays: 3 }))).toBeNull();
    expect(detectHungerRise(input(4, 2, { trainingDays: 4 }))).not.toBeNull();
  });

  it("adds a performance drop of at least 4 % over the last two weeks as an extra reason", () => {
    const perf = [
      { day: addDays(today, -3), value: -0.06 },
      { day: addDays(today, -10), value: -0.04 },
      { day: addDays(today, -30), value: 0.2 }, // too old to count
    ];
    expect(detectHungerRise(input(4, 2, { performance: perf }))?.perfDrop).toBe(
      5,
    );
    const small = [
      { day: addDays(today, -3), value: -0.02 },
      { day: addDays(today, -4), value: -0.02 },
    ];
    expect(
      detectHungerRise(input(4, 2, { performance: small }))?.perfDrop,
    ).toBeNull();
    const better = [
      { day: addDays(today, -3), value: 0.05 },
      { day: addDays(today, -4), value: 0.05 },
    ];
    expect(
      detectHungerRise(input(4, 2, { performance: better }))?.perfDrop,
    ).toBeNull();
  });

  it("splits recent and before exactly between day 6 and day 7, and ends the earlier window after day 34", () => {
    const at = (offset: number, hunger: number) => ({
      day: addDays(today, -offset),
      hunger,
    });
    // day 7 belongs to "before": four recent values (days 0..3) at 4, ten earlier at 2 (days 7..16)
    const base = [0, 1, 2, 3].map((o) => at(o, 4));
    const earlier = Array.from({ length: 10 }, (_, i) => at(7 + i, 2));
    expect(
      detectHungerRise({
        today,
        checkins: [...base, ...earlier],
        trainingDays: 5,
      }),
    ).not.toBeNull();
    // moving one high value from day 6 to day 7 takes it out of the recent window
    const tooFew = [0, 1, 2, 7].map((o) => at(o, 4));
    expect(
      detectHungerRise({
        today,
        checkins: [
          ...tooFew,
          ...Array.from({ length: 10 }, (_, i) => at(8 + i, 2)),
        ],
        trainingDays: 5,
      }),
    ).toBeNull();
    // day 35 is too old for the earlier window: only nine values remain
    const old = [
      ...Array.from({ length: 9 }, (_, i) => at(26 + i, 2)),
      at(35, 2),
    ];
    expect(
      detectHungerRise({ today, checkins: [...base, ...old], trainingDays: 5 }),
    ).toBeNull();
    const fine = [...Array.from({ length: 10 }, (_, i) => at(25 + i, 2))];
    expect(
      detectHungerRise({
        today,
        checkins: [...base, ...fine],
        trainingDays: 5,
      }),
    ).not.toBeNull();
  });

  it("needs performance on at least two days before it names a performance drop", () => {
    const one = [{ day: addDays(today, -3), value: -0.2 }];
    expect(
      detectHungerRise(input(4, 2, { performance: one }))?.perfDrop,
    ).toBeNull();
    const two = [...one, { day: addDays(today, -5), value: -0.2 }];
    expect(detectHungerRise(input(4, 2, { performance: two }))?.perfDrop).toBe(
      20,
    );
  });
});
