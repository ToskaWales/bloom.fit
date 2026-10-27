// Pins down onboarding input validation (goals, cycle date window in the German calendar, weight and units, consents). These are the rules the server enforces on health data.
import { describe, expect, it } from "vitest";
import {
  basicsStep,
  consentStep,
  cycleStep,
  goalsStep,
  kgToLbs,
  lbsToKg,
} from "./schema";

describe("goalsStep", () => {
  it("accepts one or more goals (muscle, recomp, strength)", () => {
    const r = goalsStep.safeParse({
      goals: ["muscle", "strength"],
      trainingDays: "4",
      experience: "1to3y",
    });
    expect(r.success && r.data.trainingDays).toBe(4);
  });
  it("rejects unknown goals and empty selection", () => {
    expect(
      goalsStep.safeParse({
        goals: ["weightloss"],
        trainingDays: 3,
        experience: "lt1y",
      }).success,
    ).toBe(false);
    expect(
      goalsStep.safeParse({ goals: [], trainingDays: 3, experience: "lt1y" })
        .success,
    ).toBe(false);
  });
  it("bounds training days", () => {
    expect(
      goalsStep.safeParse({
        goals: ["muscle"],
        trainingDays: 0,
        experience: "lt1y",
      }).success,
    ).toBe(false);
    expect(
      goalsStep.safeParse({
        goals: ["muscle"],
        trainingDays: 8,
        experience: "lt1y",
      }).success,
    ).toBe(false);
  });
});

describe("goalsStep extras", () => {
  it("removes duplicate goals", () => {
    const r = goalsStep.safeParse({
      goals: ["muscle", "muscle"],
      trainingDays: 3,
      experience: "lt1y",
    });
    expect(r.success && r.data.goals).toEqual(["muscle"]);
  });
});

describe("cycleStep", () => {
  const today = new Date("2026-11-10T12:00:00Z");
  it("accepts a mode without a date", () => {
    expect(cycleStep(today).safeParse({ cycleMode: "none" }).success).toBe(
      true,
    );
  });
  it("accepts a recent period start for natural/irregular", () => {
    const r = cycleStep(today).safeParse({
      cycleMode: "natural",
      lastPeriodStart: "2026-11-01",
    });
    expect(r.success && r.data.lastPeriodStart).toBe("2026-11-01");
  });
  it("rejects future dates and dates older than a year", () => {
    expect(
      cycleStep(today).safeParse({
        cycleMode: "natural",
        lastPeriodStart: "2026-12-01",
      }).success,
    ).toBe(false);
    expect(
      cycleStep(today).safeParse({
        cycleMode: "natural",
        lastPeriodStart: "2025-01-01",
      }).success,
    ).toBe(false);
  });
  it("drops the date for modes where it is meaningless", () => {
    const r = cycleStep(today).safeParse({
      cycleMode: "none",
      lastPeriodStart: "2026-11-01",
    });
    expect(r.success && r.data.lastPeriodStart).toBeNull();
  });
  it("rejects impossible calendar dates", () => {
    expect(
      cycleStep(today).safeParse({
        cycleMode: "natural",
        lastPeriodStart: "2026-02-31",
      }).success,
    ).toBe(false);
  });
  it("uses the German calendar day, so late-evening UTC entries on 'today' are accepted", () => {
    // 23:30 UTC on Nov 10 is already Nov 11 in Berlin (UTC+1)
    const lateUtc = new Date("2026-11-10T23:30:00Z");
    expect(
      cycleStep(lateUtc).safeParse({
        cycleMode: "natural",
        lastPeriodStart: "2026-11-11",
      }).success,
    ).toBe(true);
    expect(
      cycleStep(lateUtc).safeParse({
        cycleMode: "natural",
        lastPeriodStart: "2026-11-12",
      }).success,
    ).toBe(false);
  });
  it("rejects unknown modes (no phase presets)", () => {
    expect(
      cycleStep(today).safeParse({ cycleMode: "phase_synced" }).success,
    ).toBe(false);
  });
});

describe("basicsStep", () => {
  it("keeps kg as is and converts lbs", () => {
    const kg = basicsStep.safeParse({ units: "metric", startWeight: "62,5" });
    expect(kg.success && kg.data.startWeightKg).toBe(62.5);
    const lb = basicsStep.safeParse({ units: "imperial", startWeight: "150" });
    expect(lb.success && lb.data.startWeightKg).toBe(lbsToKg(150));
  });
  it("treats weight as optional", () => {
    const r = basicsStep.safeParse({ units: "metric", startWeight: "" });
    expect(r.success && r.data.startWeightKg).toBeNull();
  });
  it("round-trips lbs <-> kg for the form default", () => {
    expect(kgToLbs(lbsToKg(150))).toBeCloseTo(150, 1);
    const kg = basicsStep.safeParse({
      units: "imperial",
      startWeight: String(kgToLbs(68.04)),
    });
    expect(kg.success && kg.data.startWeightKg).toBeCloseTo(68.04, 1);
  });
  it("rejects exponent/hex notation", () => {
    expect(
      basicsStep.safeParse({ units: "metric", startWeight: "1e2" }).success,
    ).toBe(false);
    expect(
      basicsStep.safeParse({ units: "metric", startWeight: "0x50" }).success,
    ).toBe(false);
  });
  it("rejects implausible weights", () => {
    expect(
      basicsStep.safeParse({ units: "metric", startWeight: "5" }).success,
    ).toBe(false);
    expect(
      basicsStep.safeParse({ units: "metric", startWeight: "abc" }).success,
    ).toBe(false);
  });
});

describe("consentStep", () => {
  it("requires terms and health data, mail optional", () => {
    expect(
      consentStep.safeParse({ terms: "on", healthData: "on" }).success,
    ).toBe(true);
    expect(consentStep.safeParse({ terms: "on" }).success).toBe(false);
    expect(consentStep.safeParse({ healthData: "on" }).success).toBe(false);
    const r = consentStep.safeParse({
      terms: "on",
      healthData: "on",
      productMail: "on",
    });
    expect(r.success && r.data.productMail).toBe(true);
  });
});
