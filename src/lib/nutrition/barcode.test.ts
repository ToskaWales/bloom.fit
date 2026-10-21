import { describe, expect, it } from "vitest";
import { cleanBarcode, isValidBarcode } from "./barcode";

describe("isValidBarcode (GS1 check digit)", () => {
  it("accepts real EAN-13, EAN-8, UPC-A and GTIN-14 codes", () => {
    for (const ok of [
      "4006381333931",
      "40170725",
      "036000291452",
      "14006381333938",
    ])
      expect(isValidBarcode(ok), ok).toBe(true);
  });
  it("rejects a wrong check digit, wrong lengths and non-digits", () => {
    for (const bad of [
      "4006381333932",
      "40170726",
      "123",
      "",
      "40063813339311",
      "400638133393a",
      "4006 3813 33931",
    ])
      expect(isValidBarcode(bad), bad).toBe(false);
  });
});

describe("cleanBarcode", () => {
  it("strips spaces and dashes people type or paste, nothing else", () => {
    expect(cleanBarcode(" 4006 3813-33931 ")).toBe("4006381333931");
    expect(cleanBarcode("abc")).toBe("abc");
  });
});
