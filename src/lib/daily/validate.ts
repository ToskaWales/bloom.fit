// Plausibility checks for dates and numbers she enters (check-in day, cycle day,
// period end, weight). Used before saving, on top of the database rules; they
// stop typos and bad imports, not medical judgement. Date maths is in ./day.
import { addDays, daysBetween } from "./day";

// A real calendar date in YYYY-MM-DD form (rejects "2026-02-30" via the round trip).
const isDay = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && addDays(d, 0) === d;

/** How many days back a check-in may be added or edited. */
export const CHECKIN_BACKFILL_DAYS = 14;

/** Not in the future, at most CHECKIN_BACKFILL_DAYS ago. */
export const isValidCheckinDay = (day: string, today: string) =>
  isDay(day) &&
  day <= today &&
  daysBetween(day, today) <= CHECKIN_BACKFILL_DAYS;

/** Period start / ovulation test day: not in the future, at most one year back. */
export const isValidCycleDay = (day: string, today: string) =>
  isDay(day) && day <= today && daysBetween(day, today) <= 365;

/** End on or after the start and fewer than 14 days later (same limit as MAX_PERIOD_DAYS in ./cycle). */
export const isValidPeriodEnd = (start: string, end: string) =>
  isDay(start) && isDay(end) && end >= start && daysBetween(start, end) < 14;

/** 30 to 300 kg: only catches typos such as 7.5 or 750. */
export const isValidWeightKg = (kg: number) =>
  Number.isFinite(kg) && kg >= 30 && kg <= 300;
