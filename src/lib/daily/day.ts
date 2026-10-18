// Days are local calendar dates as "YYYY-MM-DD" strings. All arithmetic is done
// in UTC on the date parts, so daylight-saving changes never shift a day.
const DAY_MS = 86_400_000;
const toUtc = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const pad = (n: number) => String(n).padStart(2, "0");

export const localDay = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const addDays = (day: string, n: number): string =>
  new Date(toUtc(day) + n * DAY_MS).toISOString().slice(0, 10);

export const daysBetween = (from: string, to: string): number =>
  Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
