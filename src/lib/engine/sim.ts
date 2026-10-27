// Test support: simulates check-in data with an optional planted effect so we can
// measure how often ./patterns.ts finds real effects and how often it raises a
// false alarm. Not part of the app flow; uses ./rng.ts for reproducibility.
// Synthetic data for testing the pattern detection (test support, not shipped
// in the app bundle: only imported from tests and the evaluation script).
import { addDays } from "@/lib/daily/day";
import type { DayValue, PatternMetric } from "./patterns";
import { mulberry32 } from "./rng";

/** Standard normal random number (Box-Muller) from a uniform generator. */
export const normal = (rand: () => number) => {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
};

/** Settings for simulate(); `effect` plants a real shift, `noise` is the day-to-day spread. */
export interface SimOptions {
  seed: number;
  cycles: number;
  /** Fixed length, or [min, max] drawn per cycle. */
  length: number | [number, number];
  noise: number;
  /** Shift of a metric inside a window, in scale points (performance: fraction). */
  effect?: { metric: PatternMetric; window: "before" | "start"; size: number };
  /** Share of days without a check-in. */
  missing?: number;
}

/** Same shape the pattern analysis takes as input. */
export interface SimData {
  starts: string[];
  series: Record<PatternMetric, DayValue[]>;
}

const clampScale = (v: number) => Math.min(5, Math.max(1, Math.round(v)));

/** Builds `cycles` cycles of synthetic period starts and daily series; the same seed gives the same data. */
export function simulate(o: SimOptions): SimData {
  const rand = mulberry32(o.seed);
  const starts: string[] = [];
  let day = "2026-01-05";
  const length = () =>
    Array.isArray(o.length)
      ? o.length[0] + Math.floor(rand() * (o.length[1] - o.length[0] + 1))
      : o.length;
  starts.push(day);
  const lengths: number[] = [];
  for (let i = 0; i < o.cycles; i++) {
    const l = length();
    lengths.push(l);
    day = addDays(day, l);
    starts.push(day);
  }

  const series: SimData["series"] = {
    energy: [],
    motivation: [],
    sleep: [],
    hunger: [],
    performance: [],
  };
  starts.slice(0, -1).forEach((start, i) => {
    for (let d = 0; d < lengths[i]; d++) {
      const date = addDays(start, d);
      const inStart = d < 3;
      const inBefore = d >= lengths[i] - 4;
      for (const m of ["energy", "motivation", "sleep", "hunger"] as const) {
        if (rand() < (o.missing ?? 0)) continue;
        let mean = 3;
        if (
          o.effect &&
          o.effect.metric === m &&
          ((o.effect.window === "start" && inStart) ||
            (o.effect.window === "before" && inBefore))
        )
          mean += o.effect.size;
        series[m].push({
          day: date,
          value: clampScale(mean + normal(rand) * o.noise),
        });
      }
      if (d % 2 === 0 && rand() >= (o.missing ?? 0)) {
        let mean = 0;
        if (
          o.effect?.metric === "performance" &&
          ((o.effect.window === "start" && inStart) ||
            (o.effect.window === "before" && inBefore))
        )
          mean += o.effect.size;
        series.performance.push({
          day: date,
          value: mean + normal(rand) * (o.noise * 0.04),
        });
      }
    }
  });
  return { starts, series };
}
