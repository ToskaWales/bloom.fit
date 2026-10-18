import { describe, expect, it } from "vitest";
import {
  detectFormat,
  parseHevy,
  parseStrong,
  parseWorkoutFile,
} from "./parsers";
import { parseCsv } from "./csv";

const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push A","21 Oct 2025, 18:30","21 Oct 2025, 19:25","Gutes Training","Bench Press (Barbell)","","","0","warmup","40","10","","",""
"Push A","21 Oct 2025, 18:30","21 Oct 2025, 19:25","Gutes Training","Bench Press (Barbell)","","","1","normal","60","8","","","8.5"
"Push A","21 Oct 2025, 18:30","21 Oct 2025, 19:25","Gutes Training","Bench Press (Barbell)","","","2","failure","60","6","","",""
"Push A","21 Oct 2025, 18:30","21 Oct 2025, 19:25","Gutes Training","Triceps Pushdown (Cable - Straight Bar)","","","0","dropset","25","12","","",""
"Push A","21 Oct 2025, 18:30","21 Oct 2025, 19:25","Gutes Training","Treadmill","","","0","normal","","","2.5","900",""
"Pull B","23 Oct 2025, 07:05","23 Oct 2025, 08:00","","Pull Up (Weighted)","","","0","normal","10","5","","","9"
`;

const STRONG = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2025-10-21 18:30:00,Push A,55m,Bench Press (Barbell),W,88,10,0,0,,,
2025-10-21 18:30:00,Push A,55m,Bench Press (Barbell),1,132.5,8,0,0,,Fühlte sich gut an,8
2025-10-21 18:30:00,Push A,55m,Bench Press (Barbell),2,132.5,6,0,0,,,
2025-10-21 18:30:00,Push A,55m,Bench Press (Barbell),Rest Timer,0,0,0,120,,,
2025-10-21 18:30:00,Push A,55m,Overhead Press (Barbell),D,66,8,0,0,,,
2025-10-23 07:05:00,Pull B,1h 10m,Pull Up,1,0,9,0,0,,,
`;

describe("detectFormat", () => {
  it("recognizes both exports by their headers", () => {
    expect(detectFormat(parseCsv(HEVY))).toBe("hevy");
    expect(detectFormat(parseCsv(STRONG))).toBe("strong");
    expect(detectFormat(parseCsv("a,b\n1,2\n"))).toBe("unknown");
    expect(detectFormat([])).toBe("unknown");
  });
});

describe("parseHevy", () => {
  const result = parseHevy(parseCsv(HEVY));

  it("groups rows into workouts and exercises in file order", () => {
    expect(result.workouts.map((w) => w.title)).toEqual(["Push A", "Pull B"]);
    expect(result.workouts[0].exercises.map((e) => e.name)).toEqual([
      "Bench Press (Barbell)",
      "Triceps Pushdown (Cable - Straight Bar)",
    ]);
  });
  it("parses dates in local time, with end time and notes", () => {
    const w = result.workouts[0];
    expect(w.startedAt).toBe(new Date(2025, 9, 21, 18, 30).toISOString());
    expect(w.endedAt).toBe(new Date(2025, 9, 21, 19, 25).toISOString());
    expect(w.notes).toBe("Gutes Training");
    expect(result.workouts[1].notes).toBeNull();
  });
  it("maps set types, weights, reps and RPE", () => {
    const sets = result.workouts[0].exercises[0].sets;
    expect(sets).toEqual([
      { type: "warmup", weightKg: 40, reps: 10, rpe: null },
      { type: "normal", weightKg: 60, reps: 8, rpe: 8.5 },
      { type: "failure", weightKg: 60, reps: 6, rpe: null },
    ]);
    expect(result.workouts[0].exercises[1].sets[0].type).toBe("drop");
  });
  it("skips rows without weight and reps (cardio) and reports them", () => {
    expect(result.workouts[0].exercises.map((e) => e.name)).not.toContain(
      "Treadmill",
    );
    expect(result.skippedRows).toBe(1);
    expect(result.warnings.join(" ")).toMatch(/1/);
  });
});

describe("parseStrong", () => {
  it("converts lbs to kg and reads durations, set order markers and notes", () => {
    const r = parseStrong(parseCsv(STRONG), "lbs");
    const push = r.workouts[0];
    expect(push.startedAt).toBe(new Date(2025, 9, 21, 18, 30).toISOString());
    expect(
      new Date(push.endedAt!).getTime() - new Date(push.startedAt).getTime(),
    ).toBe(55 * 60_000);
    expect(push.notes).toBe("Fühlte sich gut an");
    expect(
      push.exercises[0].sets.map((s) => [s.type, s.weightKg, s.reps, s.rpe]),
    ).toEqual([
      ["warmup", 39.92, 10, null],
      ["normal", 60.1, 8, 8],
      ["normal", 60.1, 6, null],
    ]);
    expect(push.exercises[1].sets[0].type).toBe("drop");
    expect(
      new Date(r.workouts[1].endedAt!).getTime() -
        new Date(r.workouts[1].startedAt).getTime(),
    ).toBe(70 * 60_000);
  });
  it("keeps kg as is and ignores Rest Timer rows without counting them as skipped data", () => {
    const r = parseStrong(parseCsv(STRONG), "kg");
    expect(r.workouts[0].exercises[0].sets[1].weightKg).toBe(132.5);
    expect(r.workouts[0].exercises[0].sets).toHaveLength(3);
    expect(r.skippedRows).toBe(0);
  });
  it("treats a 0 weight with reps as bodyweight (null weight)", () => {
    const r = parseStrong(parseCsv(STRONG), "kg");
    expect(r.workouts[1].exercises[0].sets[0]).toMatchObject({
      weightKg: null,
      reps: 9,
    });
  });
});

describe("robustness", () => {
  it("skips rows with an unparseable date or implausible values instead of failing", () => {
    const bad = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
Good,"21 Oct 2025, 18:30","21 Oct 2025, 19:25",,Squat (Barbell),,,0,normal,100,5,,,
Bad date,not a date,,,Squat (Barbell),,,0,normal,100,5,,,
Heavy,"22 Oct 2025, 18:30","22 Oct 2025, 19:25",,Squat (Barbell),,,0,normal,99999,5,,,
`;
    const r = parseHevy(parseCsv(bad));
    expect(r.workouts.map((w) => w.title)).toEqual(["Good"]);
    expect(r.skippedRows).toBe(2);
  });

  it("parseWorkoutFile picks the parser and reports unknown files", () => {
    expect(parseWorkoutFile(HEVY, "kg").format).toBe("hevy");
    expect(parseWorkoutFile(STRONG, "kg").format).toBe("strong");
    const unknown = parseWorkoutFile("foo,bar\n1,2\n", "kg");
    expect(unknown.format).toBe("unknown");
    expect(unknown.workouts).toEqual([]);
  });
});
