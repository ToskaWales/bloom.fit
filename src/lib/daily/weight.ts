// Smoothed weight trend from raw weigh-ins. Only describes the numbers; whether a
// change matters is decided elsewhere (@/lib/engine/safety) and the UI avoids
// judgement. Day maths is in ./day; the overview chart (./overview) shows the trend.
import { daysBetween } from "./day";

/** One weigh-in: kg on a calendar day. */
export interface WeightPoint {
  day: string;
  kg: number;
}
/** A weigh-in plus the smoothed trend value at that day (kg, 2 decimals). */
export interface WeightTrendPoint extends WeightPoint {
  trend: number;
}

// About a week: older weigh-ins fade out with this time constant (starting value).
const TIME_CONSTANT_DAYS = 7;

// Exponentially smoothed trend that respects gaps: after a long break the next
// weigh-in counts for more. One value per day (the last one wins). The trend is
// what the app shows and reasons about; single days fluctuate a lot (water, food).
export function weightTrend(entries: WeightPoint[]): WeightTrendPoint[] {
  const byDay = new Map<string, number>();
  for (const e of entries) byDay.set(e.day, e.kg);
  const days = [...byDay.keys()].sort();

  const out: WeightTrendPoint[] = [];
  for (const day of days) {
    const kg = byDay.get(day)!;
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ day, kg, trend: kg });
      continue;
    }
    const alpha =
      1 - Math.exp(-daysBetween(prev.day, day) / TIME_CONSTANT_DAYS);
    out.push({
      day,
      kg,
      trend: Math.round((prev.trend + alpha * (kg - prev.trend)) * 100) / 100,
    });
  }
  return out;
}
