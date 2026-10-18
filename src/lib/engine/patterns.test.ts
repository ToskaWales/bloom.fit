import { describe, expect, it } from "vitest";
import { analyzePatterns } from "./patterns";
import { simulate, type SimOptions } from "./sim";

const run = (o: SimOptions, today = "2027-01-01", permutations = 1000) => {
  const d = simulate(o);
  return analyzePatterns(
    { today, starts: d.starts, series: d.series },
    { permutations, seed: 7 },
  );
};

describe("analyzePatterns", () => {
  it("finds a clear, consistent drop in the days before the period", () => {
    const r = run({
      seed: 1,
      cycles: 3,
      length: 28,
      noise: 0.5,
      effect: { metric: "energy", window: "before", size: -1.5 },
    });
    expect(r.status).toBe("found");
    if (r.status === "found") {
      const f = r.findings.find(
        (x) => x.metric === "energy" && x.window === "before",
      )!;
      expect(f).toBeDefined();
      expect(f.effect).toBeLessThan(-0.7);
      expect(f.cycles).toBeGreaterThanOrEqual(2);
      expect(f.breakdown.every((b) => b.windowAvg < b.restAvg)).toBe(true);
    }
  });

  it("finds an effect in the first days of the period", () => {
    const r = run({
      seed: 2,
      cycles: 3,
      length: 29,
      noise: 0.5,
      effect: { metric: "motivation", window: "start", size: -1.5 },
    });
    expect(
      r.status === "found" &&
        r.findings.some(
          (f) => f.metric === "motivation" && f.window === "start",
        ),
    ).toBe(true);
  });

  it("says 'no pattern' when the data shows none, with enough cycles to judge", () => {
    const r = run({ seed: 3, cycles: 3, length: 28, noise: 0.5 });
    expect(r.status).toBe("no_pattern");
  });

  it("is still collecting with fewer than two usable cycles", () => {
    const r = run({ seed: 4, cycles: 1, length: 28, noise: 0.5 });
    expect(r).toMatchObject({ status: "collecting", usableCycles: 1 });
    expect(run({ seed: 4, cycles: 0, length: 28, noise: 0.5 })).toMatchObject({
      status: "collecting",
      usableCycles: 0,
    });
  });

  it("does not call a pattern when the effect shows up in only one of the cycles", () => {
    const a = simulate({
      seed: 5,
      cycles: 1,
      length: 28,
      noise: 0.4,
      effect: { metric: "energy", window: "before", size: -2 },
    });
    const b = simulate({ seed: 6, cycles: 2, length: 28, noise: 0.4 });
    // shift the second dataset after the first so the cycles are consecutive
    const shift = (d: string, n: number) =>
      new Date(
        Date.UTC(2026, 0, 1) +
          (Date.parse(d) - Date.UTC(2026, 0, 1)) +
          n * 86400000,
      )
        .toISOString()
        .slice(0, 10);
    const offset = 28;
    const starts = [
      ...a.starts,
      ...b.starts.slice(1).map((s) => shift(s, offset)),
    ];
    const series = {
      energy: [
        ...a.series.energy,
        ...b.series.energy.map((x) => ({ ...x, day: shift(x.day, offset) })),
      ],
      motivation: [
        ...a.series.motivation,
        ...b.series.motivation.map((x) => ({
          ...x,
          day: shift(x.day, offset),
        })),
      ],
      sleep: [
        ...a.series.sleep,
        ...b.series.sleep.map((x) => ({ ...x, day: shift(x.day, offset) })),
      ],
      hunger: [
        ...a.series.hunger,
        ...b.series.hunger.map((x) => ({ ...x, day: shift(x.day, offset) })),
      ],
      performance: [],
    };
    const r = analyzePatterns(
      { today: "2027-01-01", starts, series },
      { permutations: 1000, seed: 7 },
    );
    expect(r.status).not.toBe("found");
  });

  it("needs enough check-ins inside the window and in the rest of each cycle", () => {
    const r = run({
      seed: 8,
      cycles: 3,
      length: 28,
      noise: 0.5,
      missing: 0.85,
      effect: { metric: "energy", window: "before", size: -2 },
    });
    expect(r.status).toBe("collecting");
  });

  it("is reproducible: the same data gives the same answer", () => {
    const o: SimOptions = {
      seed: 9,
      cycles: 3,
      length: 28,
      noise: 0.6,
      effect: { metric: "hunger", window: "before", size: 1.2 },
    };
    expect(JSON.stringify(run(o))).toBe(JSON.stringify(run(o)));
  });

  it("reports performance as a relative difference", () => {
    const r = run({
      seed: 10,
      cycles: 4,
      length: 28,
      noise: 0.5,
      effect: { metric: "performance", window: "start", size: -0.1 },
    });
    expect(
      r.status === "found" &&
        r.findings.some((f) => f.metric === "performance" && f.effect < -0.04),
    ).toBe(true);
  });

  it("only looks at cycles that are plausible (a missed log does not count as a cycle)", () => {
    const d = simulate({ seed: 11, cycles: 3, length: 28, noise: 0.5 });
    const starts = [d.starts[0], d.starts[1], d.starts[3]]; // drops one start -> a 56-day gap
    const r = analyzePatterns(
      { today: "2027-01-01", starts, series: d.series },
      { permutations: 200, seed: 7 },
    );
    expect(
      r.status === "collecting" ? r.completedCycles : 99,
    ).toBeLessThanOrEqual(1);
  });
});

describe("evaluation by simulation (false alarms and detection)", () => {
  const permutations = 400;
  const falseAlarmRate = (
    cycles: number,
    length: number | [number, number],
    noise: number,
    n = 120,
  ) => {
    let hits = 0;
    for (let i = 0; i < n; i++) {
      const d = simulate({ seed: 1000 + i, cycles, length, noise });
      const r = analyzePatterns(
        { today: "2027-06-01", starts: d.starts, series: d.series },
        { permutations, seed: 3 },
      );
      if (r.status === "found") hits++;
    }
    return hits / n;
  };

  it("raises a pattern on pure noise in at most 5 % of cases (regular cycles, 2 to 4 cycles)", () => {
    for (const cycles of [2, 3, 4])
      expect(
        falseAlarmRate(cycles, 28, 0.8),
        `${cycles} cycles`,
      ).toBeLessThanOrEqual(0.05);
  });

  it("stays below 5 % with irregular cycle lengths and very noisy ratings", () => {
    expect(falseAlarmRate(3, [24, 34], 1.1)).toBeLessThanOrEqual(0.05);
    expect(falseAlarmRate(3, [22, 40], 0.4)).toBeLessThanOrEqual(0.05);
  });

  it("detects a clear effect (1.5 points, 3 cycles) in most datasets", () => {
    let found = 0;
    const n = 60;
    for (let i = 0; i < n; i++) {
      const d = simulate({
        seed: 5000 + i,
        cycles: 3,
        length: 28,
        noise: 0.7,
        effect: { metric: "energy", window: "before", size: -1.5 },
      });
      const r = analyzePatterns(
        { today: "2027-06-01", starts: d.starts, series: d.series },
        { permutations, seed: 3 },
      );
      if (
        r.status === "found" &&
        r.findings.some((f) => f.metric === "energy" && f.window === "before")
      )
        found++;
    }
    expect(found / n).toBeGreaterThanOrEqual(0.7);
  });
});
