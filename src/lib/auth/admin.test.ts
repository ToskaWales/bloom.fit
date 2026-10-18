import { afterEach, describe, expect, it } from "vitest";

describe("isAdmin", () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });
  it("matches the allowlist case-insensitively and rejects others", async () => {
    process.env.ADMIN_EMAILS = " Boss@Bloom.fit, other@bloom.fit ";
    const { isAdmin } = await import("./admin");
    expect(isAdmin("boss@bloom.fit")).toBe(true);
    expect(isAdmin("nobody@bloom.fit")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
  it("is closed when no admins are configured", async () => {
    const { isAdmin } = await import("./admin");
    expect(isAdmin("boss@bloom.fit")).toBe(false);
  });
});
