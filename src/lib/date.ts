// Datums-Helfer. Alle Datumswerte in Bloom sind lokale Kalenderdaten als 'YYYY-MM-DD'.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Heutiges lokales Datum (nicht UTC, damit „heute" nach Mitternacht lokal stimmt). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function dateToIso(date: Date): string {
  return todayIso(date);
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 'TT.MM.JJJJ' */
export function formatDateDe(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
