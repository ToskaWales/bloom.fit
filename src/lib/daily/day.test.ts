import { describe, expect, it } from "vitest";
import { addDays, dayRange, daysBetween, localDay } from "./day";

describe("day helpers (local calendar days)", () => {
  it("formats the local calendar day, not the UTC day", () => {
    // 23:30 local on Nov 10 is still Nov 10 locally, whatever UTC says
    expect(localDay(new Date(2026, 10, 10, 23, 30))).toBe("2026-11-10");
    expect(localDay(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });

  it("adds days across month, year and DST boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // EU DST change on Mar 29
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26"); // and Oct 25
  });

  it("counts days between dates exactly, also over DST changes", () => {
    expect(daysBetween("2026-10-01", "2026-10-29")).toBe(28);
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
    expect(daysBetween("2026-11-02", "2026-11-02")).toBe(0);
    expect(daysBetween("2026-11-05", "2026-11-02")).toBe(-3);
  });

  it("lists an inclusive range of days", () => {
    expect(dayRange("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
    expect(dayRange("2026-03-02", "2026-02-27")).toEqual([]);
  });
});
