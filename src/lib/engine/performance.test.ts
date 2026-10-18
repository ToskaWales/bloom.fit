import { describe, expect, it } from "vitest";
import { performanceSeries } from "./performance";
import type { ExerciseSession } from "./plateau";

const s = (day: string, e1rm: number): ExerciseSession => ({ day, e1rm });
const steady = (kg: number, from = 1) =>
  Array.from({ length: 8 }, (_, i) =>
    s(`2026-10-${String(from + i * 2).padStart(2, "0")}`, kg),
  );

describe("performanceSeries", () => {
  it("is empty until an exercise has enough earlier sessions to compare with", () => {
    expect(performanceSeries(new Map([["x", steady(80).slice(0, 3)]]))).toEqual(
      [],
    );
  });

  it("expresses each session relative to the exercise's own recent level", () => {
    const sessions = [...steady(80).slice(0, 5), s("2026-10-20", 72)];
    const out = performanceSeries(new Map([["x", sessions]]));
    const last = out.find((v) => v.day === "2026-10-20")!;
    expect(last.value).toBeCloseTo(-0.1, 2);
    expect(
      out
        .filter((v) => v.day !== "2026-10-20")
        .every((v) => Math.abs(v.value) < 0.001),
    ).toBe(true);
  });

  it("makes different exercises comparable and averages several on one day", () => {
    const a = [...steady(80).slice(0, 5), s("2026-10-20", 88)]; // +10 %
    const b = [...steady(40).slice(0, 5), s("2026-10-20", 40)]; // 0 %
    const out = performanceSeries(
      new Map([
        ["a", a],
        ["b", b],
      ]),
    );
    expect(out.find((v) => v.day === "2026-10-20")!.value).toBeCloseTo(0.05, 3);
  });

  it("ignores sessions without a usable load", () => {
    expect(performanceSeries(new Map([["pullup", steady(0)]]))).toEqual([]);
  });
});
