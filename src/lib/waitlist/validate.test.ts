// Pins down waitlist input handling: email normalisation, required consent, variant fallback, honeypot and source length.
import { describe, expect, it } from "vitest";
import { parseSignup } from "./validate";

describe("parseSignup", () => {
  const base = { email: "Anna@Example.com ", consent: "on", variant: "b" };

  it("normalizes email and accepts valid input", () => {
    const r = parseSignup(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.email).toBe("anna@example.com");
      expect(r.data.variant).toBe("b");
    }
  });

  it("rejects invalid email", () => {
    expect(parseSignup({ ...base, email: "nope" }).ok).toBe(false);
  });

  it("requires consent", () => {
    expect(parseSignup({ ...base, consent: undefined }).ok).toBe(false);
  });

  it("falls back to variant a for unknown variants", () => {
    const r = parseSignup({ ...base, variant: "zzz" });
    expect(r.ok && r.data.variant).toBe("a");
  });

  it("flags honeypot", () => {
    const r = parseSignup({ ...base, website: "http://spam" });
    expect(r.ok && r.data.honeypot).toBe(true);
  });

  it("truncates/clears overlong source", () => {
    const r = parseSignup({ ...base, source: "x".repeat(200) });
    expect(r.ok && r.data.source).toBeNull();
  });
});
