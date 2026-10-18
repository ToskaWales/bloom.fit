import { addDays, daysBetween } from "./day";

const isDay = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && addDays(d, 0) === d;

export const CHECKIN_BACKFILL_DAYS = 14;

export const isValidCheckinDay = (day: string, today: string) =>
  isDay(day) &&
  day <= today &&
  daysBetween(day, today) <= CHECKIN_BACKFILL_DAYS;

export const isValidCycleDay = (day: string, today: string) =>
  isDay(day) && day <= today && daysBetween(day, today) <= 365;

export const isValidPeriodEnd = (start: string, end: string) =>
  isDay(start) && isDay(end) && end >= start && daysBetween(start, end) < 14;

export const isValidWeightKg = (kg: number) =>
  Number.isFinite(kg) && kg >= 30 && kg <= 300;
