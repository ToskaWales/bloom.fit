// Calendar-day helpers on "YYYY-MM-DD" strings, shared by every module that
// compares or steps through days (cycle, weight, engine, nutrition). No time of
// day and no time zones beyond reading the device's local date in localDay().
// Days are local calendar dates as "YYYY-MM-DD" strings. All arithmetic is done
// in UTC on the date parts, so daylight-saving changes never shift a day.
const DAY_MS = 86_400_000;
const toUtc = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const pad = (n: number) => String(n).padStart(2, "0");

/** Today's date on this device (local, not UTC), e.g. "2026-03-09". */
export const localDay = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The day n days after (or before, if negative) the given day. */
export const addDays = (day: string, n: number): string =>
  new Date(toUtc(day) + n * DAY_MS).toISOString().slice(0, 10);

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

/** Every day from `from` to `to`, both included (empty if `to` is before `from`). */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
