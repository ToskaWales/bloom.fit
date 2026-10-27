// Pins down the open-redirect guard for the login `next` parameter: only same-site paths survive.
import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("allows same-site paths", () => {
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/einstellungen?x=1")).toBe("/einstellungen?x=1");
  });
  it("falls back for external, protocol-relative or missing targets", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "/\t/evil.com",
      "/a\r\nSet-Cookie:x",
      "",
      null,
      undefined,
    ]) {
      expect(safeNext(bad as string | null | undefined)).toBe("/app");
    }
  });
});
