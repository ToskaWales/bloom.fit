import { describe, expect, it } from "vitest";
import {
  basicsStep,
  consentStep,
  cycleStep,
  goalsStep,
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
