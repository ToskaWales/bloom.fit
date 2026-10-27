// Pins down the order of onboarding steps and that finished onboarding returns null, so nobody is stuck in or skips the flow.
import { describe, expect, it } from "vitest";
import { nextStep } from "./next-step";

const base = {
  goals: [] as string[],
  training_days: null as number | null,
  experience: null as string | null,
  cycle_mode: null as string | null,
  basics_completed_at: null as string | null,
  onboarding_completed_at: null as string | null,
};

describe("nextStep", () => {
  it("walks the steps in order", () => {
    expect(nextStep(base)).toBe("ziele");
    expect(
      nextStep({
        ...base,
        goals: ["muscle"],
        training_days: 3,
        experience: "lt1y",
      }),
    ).toBe("zyklus");
    const withCycle = {
      ...base,
      goals: ["muscle"],
      training_days: 3,
      experience: "lt1y",
      cycle_mode: "none",
    };
    expect(nextStep(withCycle)).toBe("basis");
    expect(nextStep({ ...withCycle, basics_completed_at: "2026-11-01" })).toBe(
      "einwilligung",
    );
  });
  it("returns null when onboarding is finished", () => {
    expect(
      nextStep({ ...base, onboarding_completed_at: "2026-11-01" }),
    ).toBeNull();
  });
});
