import { describe, expect, it } from "vitest";
import { median, round1, round2 } from "./math";

describe("median", () => {
  it("takes the middle value, or the mean of the two middle ones", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
  });
  it("does not change the list it is given", () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe("rounding", () => {
  it("rounds to one and two decimals", () => {
    expect(round1(12.345)).toBe(12.3);
    expect(round1(100.26)).toBe(100.3);
    expect(round2(1.234)).toBe(1.23);
    expect(round2(2.456)).toBe(2.46);
  });
});
