import { describe, expect, it } from "vitest";
import { parseDecimal } from "./parse";

describe("parseDecimal", () => {
  it("reads plain and German decimals", () => {
    expect(parseDecimal("1,5")).toEqual({ ok: true, value: 1.5 });
    expect(parseDecimal("1.5")).toEqual({ ok: true, value: 1.5 });
    expect(parseDecimal(" 250 ")).toEqual({ ok: true, value: 250 });
  });
  it("reads German thousands separators when a decimal comma is present", () => {
    expect(parseDecimal("1.234,5")).toEqual({ ok: true, value: 1234.5 });
    expect(parseDecimal("1.234.567,8")).toEqual({ ok: true, value: 1234567.8 });
  });
  it("treats an empty field as no value", () => {
    expect(parseDecimal("")).toEqual({ ok: true, value: null });
    expect(parseDecimal("   ")).toEqual({ ok: true, value: null });
  });
  it("refuses ambiguous or broken input instead of guessing", () => {
    for (const bad of [
      "1.234",
      "1,2,3",
      "abc",
      "12kcal",
      "1.2.3",
      "-",
      "1e5",
      "--1",
    ])
      expect(parseDecimal(bad).ok, bad).toBe(false);
  });
  it("accepts a leading minus so range checks can reject it with their own message", () => {
    expect(parseDecimal("-5")).toEqual({ ok: true, value: -5 });
  });
});
