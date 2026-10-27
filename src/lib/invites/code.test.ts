// Pins down invite code generation, normalisation and hashing. The hash must equal the one computed in SQL, otherwise no invite could ever be redeemed.
import { describe, expect, it } from "vitest";
import {
  generateInviteCode,
  hashInviteCode,
  normalizeInviteCode,
} from "./code";

describe("invite codes", () => {
  it("generates unique, readable codes whose hash is reproducible", () => {
    const a = generateInviteCode();
    const b = generateInviteCode();
    expect(a.code).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
    expect(a.code).not.toBe(b.code);
    expect(hashInviteCode(a.code)).toBe(a.hash);
  });
  it("normalizes user input (case, spaces, missing dashes)", () => {
    const { code, hash } = generateInviteCode();
    const messy = " " + code.replaceAll("-", "").toLowerCase() + " ";
    expect(hashInviteCode(normalizeInviteCode(messy))).toBe(hash);
  });
});
