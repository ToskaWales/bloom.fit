import { addDays, daysBetween, dayRange } from "./day";

export type CycleEventKind =
  "period_start" | "period_end" | "ovulation_test_positive";
export interface CycleEvent {
  kind: CycleEventKind;
  day: string;
}

export type CycleStatus =
  | "no_data"
  | "not_enough_data"
  | "regular"
  | "irregular"
  /** Regular cycles, but the expected period is already later than the usual window. */
  | "overdue"
  /** The last logged start is too old to say anything about today. */
  | "stale";
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

// A second start within two weeks of the previous one is the same period
// (e.g. the button was tapped again on day 3), not a new cycle.
function normalizeStarts(days: string[]): string[] {
  const out: string[] = [];
  for (const d of [...new Set(days)].sort()) {
    if (out.length && daysBetween(out[out.length - 1], d) < MAX_PERIOD_DAYS)
      continue;
    out.push(d);
  }
  return out;
}

// An end belongs to a start if it follows within two weeks and comes before the next start.
function endFor(
  start: string,
  nextStart: string | undefined,
  ends: string[],
): string | undefined {
  return ends.find(
    (e) =>
      e >= start &&
      daysBetween(start, e) < MAX_PERIOD_DAYS &&
      (!nextStart || e < nextStart),
  );
}

// One forgotten log shows up as a gap of roughly twice the usual length.
// Dropping such outliers keeps a regular user from being called irregular.
const OUTLIER_FACTOR = 1.6;
function withoutMissedLogs(lengths: number[]): number[] {
  if (lengths.length < 3) return lengths;
  const m = median(lengths);
  return lengths.filter((l) => l <= OUTLIER_FACTOR * m);
}

// Descriptive statistics of the user's own logged cycles. Deliberately no phase
// names: cycle position is one input among several, and effects differ a lot
// between women. A next-period estimate is only offered for regular cycles.
export function summarizeCycle(
  events: CycleEvent[],
  today: string,
): CycleSummary {
  const starts = normalizeStarts(
    events.filter((e) => e.kind === "period_start").map((e) => e.day),
  );
  const ends = [
    ...new Set(events.filter((e) => e.kind === "period_end").map((e) => e.day)),
  ].sort();

  const plausible: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const len = daysBetween(starts[i - 1], starts[i]);
    if (len >= MIN_PLAUSIBLE && len <= MAX_PLAUSIBLE) plausible.push(len);
  }
  const lengths = withoutMissedLogs(plausible);

  const periodLengths: number[] = [];
  starts.forEach((start, i) => {
    const end = endFor(start, starts[i + 1], ends);
    if (end) periodLengths.push(daysBetween(start, end) + 1);
  });

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
  if (elapsed !== null && elapsed > MAX_PLAUSIBLE)
    return { ...base, status: "stale", prediction: null };
  if (lengths.length < MIN_CYCLES_FOR_PREDICTION)
    return { ...base, status: "not_enough_data", prediction: null };

  const sd = stdDev(lengths);
  if (sd > IRREGULAR_SD_DAYS)
    return { ...base, status: "irregular", prediction: null };

  const halfWidth = Math.max(2, Math.ceil(1.5 * sd));
  const expected = addDays(lastStart, median(lengths));
  const prediction = {
    expected,
    earliest: addDays(expected, -halfWidth),
    latest: addDays(expected, halfWidth),
  };
  // Past the window: no stale prediction, just a neutral heads-up in the UI.
  if (today > prediction.latest)
    return { ...base, status: "overdue", prediction: null };
  return { ...base, status: "regular", prediction };
}

// Days to mark as period in charts: start..end when both are logged, otherwise
// only the start day (an end is never guessed).
export function periodDaySet(events: CycleEvent[]): Set<string> {
  const starts = normalizeStarts(
    events.filter((e) => e.kind === "period_start").map((e) => e.day),
  );
  const ends = [
    ...new Set(events.filter((e) => e.kind === "period_end").map((e) => e.day)),
  ].sort();
  const days = new Set<string>();
  starts.forEach((start, i) => {
    days.add(start);
    const end = endFor(start, starts[i + 1], ends);
    if (end) for (const d of dayRange(start, end)) days.add(d);
  });
  return days;
}
