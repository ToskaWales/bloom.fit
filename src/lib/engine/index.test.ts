import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/daily/day";
import { buildCandidates, type EngineInput } from "./index";
import type { ExerciseSession } from "./plateau";
import type { PatternAnalysis } from "./patterns";
import type { SafetyResult } from "./safety";

const today = "2026-10-30";
const checkin = (offset: number, v = 3, sleep = v) => ({
  day: addDays(today, offset),
  energy: v,
  motivation: v,
  sleep_quality: sleep,
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

const inactive: SafetyResult = {
  active: false,
  overdueDays: 0,
  lowEnergy: false,
  weightFall: false,
  lowIntake: false,
};
const active: SafetyResult = {
  active: true,
  overdueDays: 9,
  lowEnergy: true,
  weightFall: false,
  lowIntake: false,
};
const finding = {
  metric: "energy" as const,
  window: "before" as const,
  effect: -1.234,
  cycles: 3,
  windowAvg: 2.456,
  restAvg: 3.69,
  breakdown: [],
};
const found: PatternAnalysis = {
  status: "found",
  usableCycles: 3,
  findings: [finding, { ...finding, metric: "sleep", effect: -0.9 }],
};

const input = (over: Partial<EngineInput> = {}): EngineInput => ({
  today,
  checkins: [],
  exerciseSessions: new Map(),
  patterns: null,
  safety: inactive,
  ...over,
});

describe("buildCandidates", () => {
  it("offers nothing without a check-in or without enough history", () => {
    expect(buildCandidates(input({ checkins: history }))).toEqual([]);
    expect(
      buildCandidates(input({ checkins: [checkin(0), checkin(-1)] })),
    ).toEqual([]);
  });

  it("emits readiness only for lower/higher days, keyed by level, with minimal params", () => {
    const [c] = buildCandidates(
      input({ checkins: [checkin(0, 5), ...history] }),
    );
    expect(c).toMatchObject({
      kind: "readiness",
      subject: "higher",
      params: { level: "higher", canPush: true },
    });
    expect(Object.keys(c.params).sort()).toEqual(["canPush", "delta", "level"]);
    const [low] = buildCandidates(
      input({ checkins: [checkin(0, 1), ...history] }),
    );
    expect(low).toMatchObject({ subject: "lower", params: { canPush: false } });
    // a usual day produces no card
    expect(
      buildCandidates(input({ checkins: [checkin(0, 3), ...history] })),
    ).toEqual([]);
  });

  it("allows the extra-rep hint only with good sleep and no safety flag", () => {
    const good = [checkin(0, 5), ...history];
    expect(
      buildCandidates(input({ checkins: good, safety: active })).find(
        (c) => c.kind === "readiness",
      )?.params.canPush,
    ).toBe(false);
    // energy and motivation high but sleep below her usual: no push
    const poorSleep = [{ ...checkin(0, 5), sleep_quality: 2 }, ...history];
    const r = buildCandidates(input({ checkins: poorSleep })).find(
      (c) => c.kind === "readiness",
    );
    expect(r?.params.level).toBe("higher");
    expect(r?.params.canPush).toBe(false);
    // no sleep logged today: no push
    const noSleep = [{ ...checkin(0, 5), sleep_quality: null }, ...history];
    expect(
      buildCandidates(input({ checkins: noSleep })).find(
        (c) => c.kind === "readiness",
      )?.params.canPush,
    ).toBe(false);
  });

  it("adds every plateau, the most trained exercises first, and skips them while a safety notice is active", () => {
    const sessions = new Map<string, ExerciseSession[]>([
      ["barbell-bench-press", plateauSessions()],
      [
        "barbell-back-squat",
        [...plateauSessions(), { day: "2026-08-01", e1rm: 70 }],
      ],
      ["pull-up", plateauSessions().slice(0, 6)],
      ["leg-press", plateauSessions().slice(0, 3)],
    ]);
    const out = buildCandidates(input({ exerciseSessions: sessions }));
    expect(out.map((c) => c.subject)).toEqual(
      ["barbell-back-squat", "barbell-bench-press"].concat(
        out.length > 2 ? out.slice(2).map((c) => c.subject) : [],
      ),
    );
    expect(out.every((c) => c.kind === "plateau")).toBe(true);
    expect(out[0].params).toMatchObject({ sessions: 4, recentBest: 85 });
    expect(
      buildCandidates(
        input({ exerciseSessions: sessions, safety: active }),
      ).filter((c) => c.kind === "plateau"),
    ).toEqual([]);
  });

  it("emits a safety candidate with the signals, ahead of everything else it would suppress", () => {
    const out = buildCandidates(
      input({
        safety: active,
        checkins: [checkin(0, 5), ...history],
        patterns: found,
      }),
    );
    expect(out.map((c) => c.kind)).toEqual(["safety", "readiness"]);
    expect(out[0]).toMatchObject({
      subject: "",
      params: { overdueDays: 9, lowEnergy: true, weightFall: false },
    });
  });

  it("emits the strongest pattern finding with rounded numbers, none while safety is active or when only collecting", () => {
    const [p] = buildCandidates(input({ patterns: found }));
    expect(p).toMatchObject({
      kind: "pattern",
      subject: "energy:before",
      params: {
        metric: "energy",
        window: "before",
        effect: -1.23,
        cycles: 3,
        windowAvg: 2.46,
        restAvg: 3.69,
      },
    });
    expect(
      buildCandidates(input({ patterns: found, safety: active })).map(
        (c) => c.kind,
      ),
    ).toEqual(["safety"]);
    expect(
      buildCandidates(
        input({
          patterns: {
            status: "collecting",
            usableCycles: 1,
            needed: 2,
            completedCycles: 1,
          },
        }),
      ),
    ).toEqual([]);
  });

  it("works without a safety result (cycle tracking off)", () => {
    expect(() => buildCandidates(input({ safety: null }))).not.toThrow();
  });

  it("carries low intake into the safety hint", () => {
    const [c] = buildCandidates(
      input({ safety: { ...active, lowIntake: true } }),
    );
    expect(c.params).toMatchObject({ lowIntake: true });
  });

  it("raises the same kind of notice without a period signal and holds back everything that suggests more", () => {
    const out = buildCandidates(
      input({
        safety: null,
        energyNote: { active: true, lowIntake: true, lowEnergy: true },
        checkins: [checkin(0, 5), ...history],
        patterns: found,
        exerciseSessions: new Map([["barbell-bench-press", plateauSessions()]]),
      }),
    );
    expect(out.map((c) => c.kind)).toEqual(["safety", "readiness"]);
    expect(out[0]).toMatchObject({
      subject: "energy",
      params: { lowIntake: true, lowEnergy: true },
    });
    expect(out[1].params.canPush).toBe(false);
  });

  it("ignores an inactive energy note", () => {
    expect(
      buildCandidates(
        input({
          safety: null,
          energyNote: { active: false, lowIntake: true, lowEnergy: false },
        }),
      ),
    ).toEqual([]);
  });
});
