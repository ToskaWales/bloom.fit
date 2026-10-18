import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/daily/day";
import { buildCandidates } from "./index";
import type { ExerciseSession } from "./plateau";

const today = "2026-10-30";
const checkin = (offset: number, v = 3) => ({
  day: addDays(today, offset),
  energy: v,
  motivation: v,
  sleep_quality: v,
});
const history = Array.from({ length: 10 }, (_, i) => checkin(-(i + 1)));
const plateauSessions = (): ExerciseSession[] =>
  [
    ["2026-08-20", 80],
    ["2026-09-03", 84],
    ["2026-09-10", 85],
    ["2026-10-01", 84],
    ["2026-10-08", 85],
    ["2026-10-15", 84],
    ["2026-10-22", 85],
  ].map(([day, e1rm]) => ({ day: day as string, e1rm: e1rm as number }));

describe("buildCandidates", () => {
  it("offers nothing without a check-in or without enough history", () => {
    expect(
      buildCandidates({
        today,
        checkins: history,
        exerciseSessions: new Map(),
        safetyFlag: false,
      }),
    ).toEqual([]);
    expect(
      buildCandidates({
        today,
        checkins: [checkin(0), checkin(-1)],
        exerciseSessions: new Map(),
        safetyFlag: false,
      }),
    ).toEqual([]);
  });

  it("explains readiness with her own numbers and only allows the extra-rep hint when it is a good day and nothing is flagged", () => {
    const good = [checkin(0, 5), ...history];
    const [c] = buildCandidates({
      today,
      checkins: good,
      exerciseSessions: new Map(),
      safetyFlag: false,
    });
    expect(c).toMatchObject({
      kind: "readiness",
      params: { level: "higher", canPush: true, energy: 5, energyBase: 3 },
    });
    const [flagged] = buildCandidates({
      today,
      checkins: good,
      exerciseSessions: new Map(),
      safetyFlag: true,
    });
    expect(flagged.params.canPush).toBe(false);
    const [low] = buildCandidates({
      today,
      checkins: [checkin(0, 1), ...history],
      exerciseSessions: new Map(),
      safetyFlag: false,
    });
    expect(low.params).toMatchObject({ level: "lower", canPush: false });
  });

  it("adds plateaus, the most trained exercises first and at most two", () => {
    const sessions = new Map<string, ExerciseSession[]>([
      ["barbell-bench-press", plateauSessions()],
      [
        "barbell-back-squat",
        [...plateauSessions(), { day: "2026-08-01", e1rm: 70 }],
      ],
      ["pull-up", plateauSessions().slice(0, 6)],
      ["leg-press", plateauSessions().slice(0, 3)], // too few sessions: no plateau
    ]);
    const out = buildCandidates({
      today,
      checkins: [],
      exerciseSessions: sessions,
      safetyFlag: false,
    });
    expect(out.map((c) => c.subject)).toEqual([
      "barbell-back-squat",
      "barbell-bench-press",
    ]);
    expect(out[0].params).toMatchObject({
      sessions: 4,
      recentBest: 85,
      earlierBest: 85,
    });
  });
});
