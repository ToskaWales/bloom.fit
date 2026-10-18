import { addDays, daysBetween, dayRange } from "./day";

export type CycleEventKind =
  "period_start" | "period_end" | "ovulation_test_positive";
export interface CycleEvent {
  kind: CycleEventKind;
  day: string;
}

export type CycleStatus =
  "no_data" | "not_enough_data" | "regular" | "irregular";
export interface CyclePrediction {
  expected: string;
  earliest: string;
  latest: string;
}
export interface CycleSummary {
  status: CycleStatus;
  /** Day of the current cycle (1 = first day of the last period), null if unknown or stale. */
  cycleDay: number | null;
  lastStart: string | null;
  lengths: number[];
  medianLength: number | null;
  periodLengths: number[];
  prediction: CyclePrediction | null;
}

// Gaps outside this range are most likely a missed log, not a real cycle.
const MIN_PLAUSIBLE = 18;
const MAX_PLAUSIBLE = 60;
const MIN_CYCLES_FOR_PREDICTION = 3;
const IRREGULAR_SD_DAYS = 7;
const MAX_PERIOD_DAYS = 14;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};
const stdDev = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
};

// Descriptive statistics of the user's own logged cycles. Deliberately no phase
// names: cycle position is one input among several, and effects differ a lot
// between women. A next-period estimate is only offered for regular cycles.
export function summarizeCycle(
  events: CycleEvent[],
  today: string,
): CycleSummary {
  const starts = [
    ...new Set(
      events.filter((e) => e.kind === "period_start").map((e) => e.day),
    ),
  ].sort();
  const ends = [
    ...new Set(events.filter((e) => e.kind === "period_end").map((e) => e.day)),
  ].sort();

  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const len = daysBetween(starts[i - 1], starts[i]);
    if (len >= MIN_PLAUSIBLE && len <= MAX_PLAUSIBLE) lengths.push(len);
  }

  const periodLengths: number[] = [];
  for (const start of starts) {
    const end = ends.find(
      (e) => e >= start && daysBetween(start, e) < MAX_PERIOD_DAYS,
    );
    if (end) periodLengths.push(daysBetween(start, end) + 1);
  }

  const lastStart = starts.at(-1) ?? null;
  const elapsed = lastStart ? daysBetween(lastStart, today) + 1 : null;
  const cycleDay =
    elapsed !== null && elapsed >= 1 && elapsed <= MAX_PLAUSIBLE
      ? elapsed
      : null;

  const base = {
    cycleDay,
    lastStart,
    lengths,
    periodLengths,
    medianLength: lengths.length ? median(lengths) : null,
  };
  if (!lastStart) return { ...base, status: "no_data", prediction: null };
  if (lengths.length < MIN_CYCLES_FOR_PREDICTION)
    return { ...base, status: "not_enough_data", prediction: null };

  const sd = stdDev(lengths);
  if (sd > IRREGULAR_SD_DAYS)
    return { ...base, status: "irregular", prediction: null };

  const typical = median(lengths);
  const halfWidth = Math.max(2, Math.ceil(1.5 * sd));
  const expected = addDays(lastStart, typical);
  return {
    ...base,
    status: "regular",
    prediction: {
      expected,
      earliest: addDays(expected, -halfWidth),
      latest: addDays(expected, halfWidth),
    },
  };
}

// Days to mark as period in charts: start..end when both are logged, otherwise
// only the start day (an end is never guessed).
export function periodDaySet(events: CycleEvent[]): Set<string> {
  const starts = events
    .filter((e) => e.kind === "period_start")
    .map((e) => e.day)
    .sort();
  const ends = events
    .filter((e) => e.kind === "period_end")
    .map((e) => e.day)
    .sort();
  const days = new Set<string>();
  for (const start of starts) {
    days.add(start);
    const end = ends.find(
      (e) => e >= start && daysBetween(start, e) < MAX_PERIOD_DAYS,
    );
    if (end) for (const d of dayRange(start, end)) days.add(d);
  }
  return days;
}
