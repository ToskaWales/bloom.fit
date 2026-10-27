// Pins down kg/lbs display and input parsing. Matters because weights are stored in
// kg and a conversion slip would corrupt training history.
import { describe, expect, it } from "vitest";
import { formatWeight, parseWeightInput } from "./units";

describe("units", () => {
  it("formats stored kg in the display unit", () => {
    expect(formatWeight(60, "metric")).toBe("60");
    expect(formatWeight(62.5, "metric")).toBe("62,5");
    expect(formatWeight(60, "imperial")).toBe("132,3");
    expect(formatWeight(null, "metric")).toBe("");
  });
  it("parses user input back to kg (comma or dot, either unit)", () => {
    expect(parseWeightInput("62,5", "metric")).toBe(62.5);
    expect(parseWeightInput("132.3", "imperial")).toBeCloseTo(60, 0);
    expect(parseWeightInput("", "metric")).toBeNull();
  });
  it("rejects nonsense and out-of-range input", () => {
    expect(parseWeightInput("abc", "metric")).toBeUndefined();
    expect(parseWeightInput("-5", "metric")).toBeUndefined();
    expect(parseWeightInput("1e3", "metric")).toBeUndefined();
    expect(parseWeightInput("2000", "metric")).toBeUndefined();
  });
});
