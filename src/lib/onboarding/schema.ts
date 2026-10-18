import { z } from "zod";

export const GOALS = ["muscle", "recomp", "strength"] as const;
export const EXPERIENCE = ["lt1y", "1to3y", "gt3y"] as const;
export const CYCLE_MODES = [
  "natural",
  "hormonal",
  "irregular",
  "none",
] as const;
export const UNITS = ["metric", "imperial"] as const;

// Bump a version when the underlying legal text changes materially.
export const CONSENT_VERSIONS = {
  terms: "2026-11-draft",
  health_data: "2026-11-draft",
  product_mail: "2026-11",
} as const;

export const lbsToKg = (lbs: number) =>
  Math.round(lbs * 0.45359237 * 100) / 100;
export const kgToLbs = (kg: number) => Math.round((kg / 0.45359237) * 10) / 10;

const checkbox = z.preprocess(
  (v) => v === "on" || v === true || v === "true",
  z.boolean(),
);

export const goalsStep = z.object({
  goals: z
    .array(z.enum(GOALS))
    .min(1)
    .transform((g) => [...new Set(g)]),
  trainingDays: z.coerce.number().int().min(1).max(7),
  experience: z.enum(EXPERIENCE),
});

const DAY_MS = 24 * 3600_000;

// Calendar day in Germany, so entries around midnight aren't rejected as "future".
const berlinDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(d);

const isRealDate = (d: string) => {
  const parsed = new Date(`${d}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d
  );
};

export function cycleStep(today: Date) {
  const max = berlinDay(today);
  const min = berlinDay(new Date(today.getTime() - 366 * DAY_MS));
  return z
    .object({
      cycleMode: z.enum(CYCLE_MODES),
      lastPeriodStart: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine(isRealDate)
        .refine((d) => d <= max && d >= min)
        .optional(),
    })
    .transform((v) => ({
      cycleMode: v.cycleMode,
      lastPeriodStart:
        v.cycleMode === "natural" || v.cycleMode === "irregular"
          ? (v.lastPeriodStart ?? null)
          : null,
    }));
}

export { berlinDay };

export const basicsStep = z
  .object({
    units: z.enum(UNITS),
    startWeight: z.string().trim().optional(),
  })
  .transform((v, ctx) => {
    if (!v.startWeight)
      return { units: v.units, startWeightKg: null as number | null };
    if (!/^\d{2,3}([.,]\d{1,2})?$/.test(v.startWeight)) {
      ctx.addIssue({
        code: "custom",
        message: "implausible weight",
        path: ["startWeight"],
      });
      return z.NEVER;
    }
    const n = Number(v.startWeight.replace(",", "."));
    const kg = v.units === "imperial" ? lbsToKg(n) : n;
    if (kg < 30 || kg > 300) {
      ctx.addIssue({
        code: "custom",
        message: "implausible weight",
        path: ["startWeight"],
      });
      return z.NEVER;
    }
    return { units: v.units, startWeightKg: kg as number | null };
  });

export const consentStep = z.object({
  terms: checkbox.refine((v) => v === true),
  healthData: checkbox.refine((v) => v === true),
  productMail: checkbox,
});
