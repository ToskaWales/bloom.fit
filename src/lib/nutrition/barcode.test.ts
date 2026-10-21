import { describe, expect, it } from "vitest";
import { cleanBarcode, isValidBarcode, normaliseBarcode } from "./barcode";

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

describe("normaliseBarcode", () => {
  it("maps UPC-A, EAN-13 and zero-padded GTIN-14 of the same product to one form", () => {
    expect(normaliseBarcode("036000291452")).toBe("0036000291452");
    expect(normaliseBarcode("0036000291452")).toBe("0036000291452");
    expect(normaliseBarcode("00036000291452")).toBe("0036000291452");
  });
  it("keeps EAN-8, EAN-13 and a real GTIN-14 as they are, and refuses invalid codes", () => {
    expect(normaliseBarcode("40170725")).toBe("40170725");
    expect(normaliseBarcode("4006381333931")).toBe("4006381333931");
    expect(normaliseBarcode("14006381333938")).toBe("14006381333938");
    expect(normaliseBarcode("4006381333932")).toBeNull();
  });
});
