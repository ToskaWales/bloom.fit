// Zod schemas for each onboarding step (goals, cycle, basics, consent) plus the
// shared option lists, unit conversion and consent versions. They validate every
// server action input; the database repeats the key checks. Which step comes next is ./next-step.ts.
import { z } from "zod";

// Option lists; "Abnehmen" is deliberately not a goal (see CLAUDE.md product guardrails).
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
  nutrition: "2026-11-draft",
} as const;

// Conversions for the pound input: rounded to 0.01 kg / 0.1 lb for display and storage.
export const lbsToKg = (lbs: number) =>
  Math.round(lbs * 0.45359237 * 100) / 100;
export const kgToLbs = (kg: number) => Math.round((kg / 0.45359237) * 10) / 10;

// HTML checkboxes send "on" (or nothing); also accepts booleans from tests/JSON.
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

// A function (not a constant) so `today` can be injected in tests. The date of the
// last period is only kept for modes that track periods, must be a real calendar
// day and lie within the last 366 days (never in the future).
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

// Exported so server code and tests share the same definition of "today".
export { berlinDay };

// Units plus an optional start weight. Weight accepts only plain decimals (no
// exponent/hex), is converted to kg and must be plausible (30-300 kg).
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

// Terms and health-data consent are required (Art. 9 GDPR); the product mail is optional opt-in.
export const consentStep = z.object({
  terms: checkbox.refine((v) => v === true),
  healthData: checkbox.refine((v) => v === true),
  productMail: checkbox,
});
