import { dateToIso, formatDateDe, isIsoDate, isoToDate, todayIso } from './date';

describe('date helpers', () => {
  it('todayIso nutzt das lokale Datum', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
  it('isIsoDate prüft Format und Kalender', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-2-3')).toBe(false);
    expect(isIsoDate('heute')).toBe(false);
  });
  it('wandelt hin und zurück', () => {
    expect(dateToIso(isoToDate('2026-03-09'))).toBe('2026-03-09');
  });
  it('formatiert deutsch', () => {
    expect(formatDateDe('2026-03-09')).toBe('09.03.2026');
  });
});
