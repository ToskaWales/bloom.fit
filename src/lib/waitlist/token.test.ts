import { describe, expect, it } from "vitest";
import { createToken, hashToken } from "./token";

describe("token", () => {
  it("creates url-safe, unique tokens whose hash matches", () => {
    const a = createToken();
    const b = createToken();
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(a.token).not.toBe(b.token);
    expect(hashToken(a.token)).toBe(a.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
