import { daysBetween } from "@/lib/daily/day";

export interface ReadinessCheckin {
  day: string;
  energy: number | null;
  motivation: number | null;
  sleep_quality: number | null;
}

export type ReadinessPart = {
  metric: "energy" | "motivation" | "sleep";
  value: number;
  baseline: number;
};

export type ReadinessResult =
  | { status: "no_checkin" }
  | { status: "not_enough_data"; have: number; need: number }
  | {
      status: "ready";
      level: "lower" | "usual" | "higher";
      delta: number;
      parts: ReadinessPart[];
    };

// Starting values, not proven limits: they should be revisited with real data
// (and a sports-science review) once users have logged a few cycles.
export const BASELINE_DAYS = 28;
export const MIN_BASELINE_VALUES = 7;
export const MIN_METRICS = 2;
export const LEVEL_THRESHOLD = 0.8; // average distance from her own median, on the 1–5 scale

const METRICS = [
  { key: "energy", metric: "energy" },
  { key: "motivation", metric: "motivation" },
  { key: "sleep_quality", metric: "sleep" },
] as const;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

// How today's check-in compares with the person's own recent normal (median of
// the previous 28 days), never with an absolute scale: a "2" can be normal for her.
export function computeReadiness(
  today: string,
  checkins: ReadinessCheckin[],
): ReadinessResult {
  const todays = [...checkins].reverse().find((c) => c.day === today);
  if (!todays) return { status: "no_checkin" };

  const prior = checkins.filter(
    (c) => c.day < today && daysBetween(c.day, today) <= BASELINE_DAYS,
  );
  const parts: ReadinessPart[] = [];
  let have = 0;
  for (const { key, metric } of METRICS) {
    const value = todays[key];
    if (value === null) continue; // only metrics she logged today count
    const values = prior
      .map((c) => c[key])
      .filter((v): v is number => v !== null);
    have = Math.max(have, values.length);
    if (values.length < MIN_BASELINE_VALUES) continue;
    parts.push({ metric, value, baseline: median(values) });
  }
  if (parts.length < MIN_METRICS)
    return { status: "not_enough_data", have, need: MIN_BASELINE_VALUES };

  const mean =
    parts.reduce((sum, p) => sum + (p.value - p.baseline), 0) / parts.length;
  // A day only counts as lower/higher when at least two values point the same
  // way: one outlier among normal values is noise, with two or three metrics alike.
  const agreeing = (sign: 1 | -1) =>
    parts.filter((p) => Math.sign(p.value - p.baseline) === sign).length;
  let level: "lower" | "usual" | "higher" = "usual";
  if (mean <= -LEVEL_THRESHOLD && agreeing(-1) >= 2) level = "lower";
  else if (mean >= LEVEL_THRESHOLD && agreeing(1) >= 2) level = "higher";
  return { status: "ready", level, delta: round1(mean), parts };
}
