import { dayRange } from "./day";
import { weightTrend, type WeightPoint } from "./weight";

export interface CheckinPoint {
  day: string;
  energy: number | null;
  motivation: number | null;
  sleep_quality: number | null;
  sleep_hours: number | null;
  hunger: number | null;
  symptoms: string[];
}

export interface OverviewRow {
  day: string;
  period: boolean;
  energy: number | null;
  motivation: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
  hunger: number | null;
  symptoms: string[];
  weightKg: number | null;
  weightTrend: number | null;
  volumeKg: number;
}

interface Input {
  from: string;
  to: string;
  checkins: CheckinPoint[];
  /** Pass earlier weigh-ins too: the trend needs them. Empty = weight hidden. */
  weights: WeightPoint[];
  workouts: { day: string; volumeKg: number }[];
  periodDays: Set<string>;
}

// One row per day in the window, joining everything the overview chart shows.
export function buildOverview({
  from,
  to,
  checkins,
  weights,
  workouts,
  periodDays,
}: Input): OverviewRow[] {
  const checkinByDay = new Map(checkins.map((c) => [c.day, c]));
  const volumeByDay = new Map<string, number>();
  for (const w of workouts)
    volumeByDay.set(w.day, (volumeByDay.get(w.day) ?? 0) + w.volumeKg);

  const trend = weightTrend(weights);
  const trendByDay = new Map(trend.map((p) => [p.day, p]));
  let carried: number | null = null;
  // trend values from before the window carry into it
  for (const p of trend) if (p.day < from) carried = p.trend;

  return dayRange(from, to).map((day) => {
    const c = checkinByDay.get(day);
    const w = trendByDay.get(day);
    if (w) carried = w.trend;
    return {
      day,
      period: periodDays.has(day),
      energy: c?.energy ?? null,
      motivation: c?.motivation ?? null,
      sleepQuality: c?.sleep_quality ?? null,
      sleepHours: c?.sleep_hours ?? null,
      hunger: c?.hunger ?? null,
      symptoms: c?.symptoms ?? [],
      weightKg: w?.kg ?? null,
      weightTrend: carried,
      volumeKg: volumeByDay.get(day) ?? 0,
    };
  });
}
