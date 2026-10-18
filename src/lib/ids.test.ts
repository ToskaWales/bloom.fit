import { describe, expect, it } from "vitest";
import { dailyId } from "./ids";

describe("dailyId", () => {
  it("is stable per user, kind and day and differs otherwise", async () => {
    const a = await dailyId("u1", "checkin", "2026-10-02");
    expect(await dailyId("u1", "checkin", "2026-10-02")).toBe(a);
    expect(await dailyId("u2", "checkin", "2026-10-02")).not.toBe(a);
    expect(await dailyId("u1", "weight", "2026-10-02")).not.toBe(a);
    expect(await dailyId("u1", "checkin", "2026-10-03")).not.toBe(a);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
