import { kgToLbs, lbsToKg } from "@/lib/onboarding/schema";

export type Units = "metric" | "imperial";

const trim = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export function formatWeight(kg: number | null, units: Units): string {
  if (kg == null) return "";
  return trim(units === "imperial" ? kgToLbs(kg) : kg);
}

// "" -> null (empty field); invalid -> undefined; otherwise kg with 2 decimals.
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

export const weightLabel = (units: Units) =>
  units === "imperial" ? "lbs" : "kg";
