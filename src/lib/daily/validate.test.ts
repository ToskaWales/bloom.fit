import { describe, expect, it } from "vitest";
import {
  isValidCheckinDay,
  isValidCycleDay,
  isValidPeriodEnd,
  isValidWeightKg,
} from "./validate";

const today = "2026-10-18";

describe("daily input validation", () => {
  it("check-ins: today and up to 14 days back, never the future", () => {
    expect(isValidCheckinDay("2026-10-18", today)).toBe(true);
    expect(isValidCheckinDay("2026-10-04", today)).toBe(true);
    expect(isValidCheckinDay("2026-10-03", today)).toBe(false);
    expect(isValidCheckinDay("2026-10-19", today)).toBe(false);
    expect(isValidCheckinDay("garbage", today)).toBe(false);
  });
  it("cycle days: within the last year, not in the future", () => {
    expect(isValidCycleDay("2026-10-18", today)).toBe(true);
    expect(isValidCycleDay("2025-10-19", today)).toBe(true);
    expect(isValidCycleDay("2025-10-01", today)).toBe(false);
    expect(isValidCycleDay("2026-10-19", today)).toBe(false);
  });
  it("period end: on or after the start and within 14 days", () => {
    expect(isValidPeriodEnd("2026-10-05", "2026-10-05")).toBe(true);
    expect(isValidPeriodEnd("2026-10-05", "2026-10-09")).toBe(true);
    expect(isValidPeriodEnd("2026-10-05", "2026-10-04")).toBe(false);
    expect(isValidPeriodEnd("2026-10-05", "2026-10-19")).toBe(false);
  });
  it("weight: 30 to 300 kg", () => {
    expect([29.9, 30, 62.4, 300, 300.1].map(isValidWeightKg)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });
});
