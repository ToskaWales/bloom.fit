import { isIsoDate, todayIso } from './date';

export type CycleInput = { periodStart: string | null; periodEnd: string | null };
export type CycleInputError = 'required' | 'invalidDate' | 'futureDate' | 'endBeforeStart';

/** Prüft Beginn/Ende einer Periode. Ende ist optional (Periode läuft noch). */
export function validateCycleInput(
  input: CycleInput,
  today: string = todayIso(),
): CycleInputError | null {
  if (!input.periodStart) return 'required';
  if (!isIsoDate(input.periodStart)) return 'invalidDate';
  if (input.periodStart > today) return 'futureDate';
  if (input.periodEnd) {
    if (!isIsoDate(input.periodEnd)) return 'invalidDate';
    if (input.periodEnd > today) return 'futureDate';
    if (input.periodEnd < input.periodStart) return 'endBeforeStart';
  }
  return null;
}

/** Tage einer Periode inklusive Start- und Endtag. */
export function periodLengthDays(start: string, end: string): number {
  const toDay = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return toDay(end) - toDay(start) + 1;
}
