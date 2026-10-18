import { addDays } from "@/lib/daily/day";
import { plausibleCycles } from "@/lib/daily/cycle";
import { mulberry32 } from "./rng";

export type PatternMetric =
  "energy" | "motivation" | "sleep" | "hunger" | "performance";
export type PatternWindow = "before" | "start";
export interface DayValue {
  day: string;
  value: number;
}

export interface PatternInput {
  today: string;
  /** Period start days (any order, duplicates allowed). */
  starts: string[];
  series: Record<PatternMetric, DayValue[]>;
}

export interface CycleBreakdown {
  start: string;
  next: string;
  windowAvg: number;
  restAvg: number;
  windowN: number;
  restN: number;
}

export interface PatternFinding {
  metric: PatternMetric;
  window: PatternWindow;
  /** Mean difference (window minus the other days) over the usable cycles. Scale points, or a fraction for performance. */
  effect: number;
  cycles: number;
  windowAvg: number;
  restAvg: number;
  breakdown: CycleBreakdown[];
}

export type PatternAnalysis =
  | {
      status: "collecting";
      usableCycles: number;
      needed: number;
      completedCycles: number;
    }
  | { status: "no_pattern"; usableCycles: number; tested: number }
  | { status: "found"; usableCycles: number; findings: PatternFinding[] };

// Starting values, not proven limits. A pattern is only reported when ALL of
// these hold: enough observations in at least two cycles, an average difference
// of a meaningful size, the same direction (and at least half the size) in every
// usable cycle, and a permutation test that rules out chance (Bonferroni-corrected, see ALPHA).
// With ten comparisons per person this keeps false alarms on noise below 5 %
// (checked by simulation in patterns.test.ts).
export const WINDOW_DAYS: Record<PatternWindow, number> = {
  before: 4,
  start: 3,
};
export const MIN_USABLE_CYCLES = 2;
// Ten comparisons per person (5 measures x 2 windows): 0.05 / 10, so that chance
// alone produces a pattern in at most about 5 % of people.
export const ALPHA = 0.005;
// Longer "cycles" are very likely two cycles with a missed log; windows would be wrong.
export const MAX_PATTERN_CYCLE_DAYS = 45;
const THRESHOLD: Record<PatternMetric, number> = {
  energy: 0.7,
  motivation: 0.7,
  sleep: 0.7,
  hunger: 0.7,
  performance: 0.04,
};
const MIN_OBS: Record<PatternMetric, { window: number; rest: number }> = {
  energy: { window: 2, rest: 6 },
  motivation: { window: 2, rest: 6 },
  sleep: { window: 2, rest: 6 },
  hunger: { window: 2, rest: 6 },
  performance: { window: 1, rest: 3 },
};
const METRICS: PatternMetric[] = [
  "energy",
  "motivation",
  "sleep",
  "hunger",
  "performance",
];
const WINDOWS: PatternWindow[] = ["before", "start"];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function perDay(series: DayValue[]): Map<string, number> {
  const sums = new Map<string, { sum: number; n: number }>();
  for (const { day, value } of series) {
    const s = sums.get(day) ?? { sum: 0, n: 0 };
    sums.set(day, { sum: s.sum + value, n: s.n + 1 });
  }
  return new Map([...sums].map(([d, s]) => [d, s.sum / s.n]));
}

interface Sample {
  start: string;
  next: string;
  win: number[];
  rest: number[];
}

// Values inside the window vs. the other days of the same cycle. The other
// window is left out, so the contrast is clean.
function sampleCycle(
  start: string,
  next: string,
  length: number,
  window: PatternWindow,
  values: Map<string, number>,
): Sample {
  const win: number[] = [];
  const rest: number[] = [];
  for (let d = 0; d < length; d++) {
    const v = values.get(addDays(start, d));
    if (v === undefined) continue;
    const inBefore = d >= length - WINDOW_DAYS.before;
    const inStart = d < WINDOW_DAYS.start;
    const inWindow = window === "before" ? inBefore : inStart;
    const inOther = window === "before" ? inStart : inBefore;
    if (inWindow) win.push(v);
    else if (!inOther) rest.push(v);
  }
  return { start, next, win, rest };
}

// Shuffles the window labels inside each cycle: how often does chance alone
// produce an average difference at least as large as the observed one?
function permutationP(
  samples: Sample[],
  observed: number,
  permutations: number,
  rand: () => number,
): number {
  let atLeast = 0;
  for (let p = 0; p < permutations; p++) {
    let total = 0;
    for (const s of samples) {
      const pool = [...s.win, ...s.rest];
      const k = s.win.length;
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rand() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      total += mean(pool.slice(0, k)) - mean(pool.slice(k));
    }
    if (Math.abs(total / samples.length) >= Math.abs(observed) - 1e-12)
      atLeast++;
  }
  return (atLeast + 1) / (permutations + 1);
}

export function analyzePatterns(
  input: PatternInput,
  options: { permutations?: number; seed?: number } = {},
): PatternAnalysis {
  const { permutations = 2000, seed = 1 } = options;
  const cycles = plausibleCycles(
    input.starts.map((day) => ({ kind: "period_start" as const, day })),
  ).filter((c) => c.length <= MAX_PATTERN_CYCLE_DAYS);

  const findings: PatternFinding[] = [];
  let usableMax = 0;
  let tested = 0;
  METRICS.forEach((metric, mi) => {
    const values = perDay(input.series[metric]);
    WINDOWS.forEach((window, wi) => {
      const need = MIN_OBS[metric];
      const usable = cycles
        .map((c) => sampleCycle(c.start, c.next, c.length, window, values))
        .filter(
          (s) => s.win.length >= need.window && s.rest.length >= need.rest,
        );
      usableMax = Math.max(usableMax, usable.length);
      if (usable.length < MIN_USABLE_CYCLES) return;
      tested++;

      const diffs = usable.map((s) => mean(s.win) - mean(s.rest));
      const effect = mean(diffs);
      const threshold = THRESHOLD[metric];
      if (Math.abs(effect) < threshold) return;
      const sign = Math.sign(effect);
      if (
        !diffs.every(
          (d) => Math.sign(d) === sign && Math.abs(d) >= threshold / 2,
        )
      )
        return;
      const p = permutationP(
        usable,
        effect,
        permutations,
        mulberry32(seed * 1009 + mi * 31 + wi),
      );
      if (p >= ALPHA) return;

      findings.push({
        metric,
        window,
        effect,
        cycles: usable.length,
        windowAvg: mean(usable.map((s) => mean(s.win))),
        restAvg: mean(usable.map((s) => mean(s.rest))),
        breakdown: usable.map((s) => ({
          start: s.start,
          next: s.next,
          windowAvg: mean(s.win),
          restAvg: mean(s.rest),
          windowN: s.win.length,
          restN: s.rest.length,
        })),
      });
    });
  });

  if (tested === 0)
    return {
      status: "collecting",
      usableCycles: usableMax,
      needed: MIN_USABLE_CYCLES,
      completedCycles: cycles.length,
    };
  if (findings.length === 0)
    return { status: "no_pattern", usableCycles: usableMax, tested };
  findings.sort(
    (a, b) =>
      Math.abs(b.effect) / THRESHOLD[b.metric] -
      Math.abs(a.effect) / THRESHOLD[a.metric],
  );
  return { status: "found", usableCycles: usableMax, findings };
}
