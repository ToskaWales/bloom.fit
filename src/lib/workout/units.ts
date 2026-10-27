// Display and input of weights in kg or lbs. Everything is stored in kg; this
// only converts at the edge (screens, forms). The conversion factors live in
// @/lib/onboarding/schema so onboarding and training agree.
import { kgToLbs, lbsToKg } from "@/lib/onboarding/schema";

/** The person's unit setting; storage stays metric. */
export type Units = "metric" | "imperial";

// One decimal at most, German decimal comma ("82,5").
const trim = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** kg value as text in her unit, without the unit label; empty string for null. */
export function formatWeight(kg: number | null, units: Units): string {
  if (kg == null) return "";
  return trim(units === "imperial" ? kgToLbs(kg) : kg);
}

/**
 * Reads a typed weight (up to 4 digits, 2 decimals, comma or dot) in her unit.
 * "" -> null (empty field); invalid -> undefined; otherwise kg with 2 decimals.
 */
export function parseWeightInput(
  input: string,
  units: Units,
): number | null | undefined {
  const text = input.trim();
  if (text === "") return null;
  if (!/^\d{1,4}([.,]\d{1,2})?$/.test(text)) return undefined;
  const value = Number(text.replace(",", "."));
  const kg = units === "imperial" ? lbsToKg(value) : value;
  return kg >= 0 && kg <= 1000 ? Math.round(kg * 100) / 100 : undefined;
}

/** "kg" or "lbs". */
export const weightLabel = (units: Units) =>
  units === "imperial" ? "lbs" : "kg";
