// Small numeric helpers shared by the engine, the cycle logic and the nutrition code.
// Only generic maths lives here: anything that knows about days, kcal or sets
// belongs in daily/, nutrition/ or workout/.

/** The middle value of a non-empty list (mean of the two middle values for an even count). */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Rounds to one decimal place (the precision the database stores for amounts). */
export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Rounds to two decimal places. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;
