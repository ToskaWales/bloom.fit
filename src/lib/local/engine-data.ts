// Reads the person's own data from the local database and turns it into what the
// adaptation engine needs (src/lib/engine): exercise sessions, check-ins, cycle
// events, weight and intake, plus a cheap "did anything change?" signature.
// Read-only: storing hints is suggestions.ts. Deleted rows are never passed on, and
// weight and food entries are only read when she has not hidden or switched them off.
import { addDays, localDay } from "@/lib/daily/day";
import type { WeightPoint } from "@/lib/daily/weight";
import {
  analyzePatterns,
  type DayValue,
  type PatternAnalysis,
  type PatternMetric,
} from "@/lib/engine/patterns";
import { performanceSeries } from "@/lib/engine/performance";
import type { ExerciseSession } from "@/lib/engine/plateau";
import type { IntakeEntry } from "@/lib/engine/safety";
import { estimateOneRepMax } from "@/lib/workout/stats";
import type { NutritionMode } from "@/components/local-provider";
import type { LocalDb } from "./db";
import type {
  CheckinRow,
  CycleEventRow,
  FoodLogRow,
  SetRow,
  WeightRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from "./types";

const SESSION_DAYS = 200; // plateau looks 56 + 84 days back, patterns need a few earlier sessions
const PATTERN_DAYS = 200; // check-ins for pattern detection: a handful of cycles
const WEIGHT_DAYS = 60;
const INTAKE_DAYS = 14;
const TRAINING_WINDOW_DAYS = 14;

// Best estimated 1RM per exercise and workout over the last SESSION_DAYS days,
// from local data. Warm-ups, unticked sets and bodyweight sets are ignored.
export async function exerciseSessionsFromDb(
  db: LocalDb,
  today: string,
): Promise<Map<string, ExerciseSession[]>> {
  const lower = new Date(
    `${addDays(today, -SESSION_DAYS)}T00:00:00`,
  ).toISOString();
  const workouts = (
    (await db.workouts
      .where("started_at")
      .aboveOrEqual(lower)
      .toArray()) as WorkoutRow[]
  ).filter((w) => !w.deleted_at && w.ended_at !== null); // a running workout is not a session yet
  if (!workouts.length) return new Map();
  const dayOf = new Map(
    workouts.map((w) => [w.id, localDay(new Date(w.started_at))]),
  );

  const exercises = (await db.workout_exercises
    .where("workout_id")
    .anyOf([...dayOf.keys()])
    .filter((e) => !e.deleted_at)
    .toArray()) as WorkoutExerciseRow[];
  if (!exercises.length) return new Map();
  const sets = (await db.workout_sets
    .where("workout_exercise_id")
    .anyOf(exercises.map((e) => e.id))
    .toArray()) as SetRow[];
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  const best = new Map<string, Map<string, number>>(); // exercise_id -> workout_id -> best e1RM
  for (const s of sets) {
    if (
      s.deleted_at ||
      !s.completed ||
      s.set_type === "warmup" ||
      (s.weight_kg ?? 0) <= 0
    )
      continue;
    const e1rm = estimateOneRepMax(s.weight_kg, s.reps);
    const ex = exerciseById.get(s.workout_exercise_id);
    if (e1rm === null || !ex) continue;
    const perWorkout = best.get(ex.exercise_id) ?? new Map<string, number>();
    perWorkout.set(
      ex.workout_id,
      Math.max(perWorkout.get(ex.workout_id) ?? 0, e1rm),
    );
    best.set(ex.exercise_id, perWorkout);
  }

  const out = new Map<string, ExerciseSession[]>();
  for (const [exerciseId, perWorkout] of best) {
    out.set(
      exerciseId,
      [...perWorkout].map(([workoutId, e1rm]) => ({
        day: dayOf.get(workoutId)!,
        e1rm,
      })),
    );
  }
  return out;
}

// Distinct days with a finished, non-deleted workout. Independent of 1RM data,
// so bodyweight work and high-rep sets count as training too.
async function finishedWorkoutDays(
  db: LocalDb,
  today: string,
): Promise<number> {
  const lower = new Date(
    `${addDays(today, -TRAINING_WINDOW_DAYS)}T00:00:00`,
  ).toISOString();
  const rows = (await db.workouts
    .where("started_at")
    .aboveOrEqual(lower)
    .toArray()) as WorkoutRow[];
  const days = new Set<string>();
  for (const w of rows) {
    if (w.deleted_at || w.ended_at === null) continue;
    const day = localDay(new Date(w.started_at));
    if (day <= today && day > addDays(today, -TRAINING_WINDOW_DAYS))
      days.add(day);
  }
  return days.size;
}

// Check-in fields the pattern analysis looks at (performance is added separately).
const SERIES: { metric: PatternMetric; key: keyof CheckinRow }[] = [
  { metric: "energy", key: "energy" },
  { metric: "motivation", key: "motivation" },
  { metric: "sleep", key: "sleep_quality" },
  { metric: "hunger", key: "hunger" },
];

// Everything the engine may read, already filtered (no deleted rows, weight/intake only if allowed).
export interface EngineData {
  checkins: CheckinRow[];
  starts: string[];
  cycleEvents: CycleEventRow[];
  weights: WeightPoint[];
  intake: IntakeEntry[] | null;
  /** Days with a finished workout in the last two weeks (any exercise, any rep range). */
  trainingDays: number;
  exerciseSessions: Map<string, ExerciseSession[]>;
}

// intake is null (never read) when nutrition is off; weights are [] when hidden.
export async function loadEngineData(
  db: LocalDb,
  today: string,
  hideWeight = false,
  nutritionMode: NutritionMode = "off",
): Promise<EngineData> {
  const checkins = (
    (await db.checkins
      .where("day")
      .between(addDays(today, -PATTERN_DAYS), today, true, true)
      .toArray()) as CheckinRow[]
  ).filter((c) => !c.deleted_at);
  const cycleEvents = (
    (await db.cycle_events.toArray()) as CycleEventRow[]
  ).filter((e) => !e.deleted_at);
  const weights = hideWeight
    ? []
    : (
        (await db.bodyweight_entries
          .where("day")
          .between(addDays(today, -WEIGHT_DAYS), today, true, true)
          .toArray()) as WeightRow[]
      )
        .filter((w) => !w.deleted_at)
        .map((w) => ({ day: w.day, kg: w.weight_kg }));
  const intake =
    nutritionMode === "off"
      ? null
      : (
          (await db.food_logs
            .where("day")
            .between(addDays(today, -INTAKE_DAYS), today, true, true)
            .toArray()) as FoodLogRow[]
        )
          .filter((l) => !l.deleted_at)
          .map((l) => ({ day: l.day, kcal: l.kcal }));
  const trainingDays = await finishedWorkoutDays(db, today);
  return {
    checkins,
    cycleEvents,
    intake,
    trainingDays,
    starts: cycleEvents
      .filter((e) => e.kind === "period_start")
      .map((e) => e.day),
    weights,
    exerciseSessions: await exerciseSessionsFromDb(db, today),
  };
}

// Builds the per-metric daily series and runs the cycle-pattern analysis.
export function patternsFrom(data: EngineData, today: string): PatternAnalysis {
  const series = {
    performance: performanceSeries(data.exerciseSessions),
  } as Record<PatternMetric, DayValue[]>;
  for (const { metric, key } of SERIES) {
    series[metric] = data.checkins.flatMap((c) =>
      typeof c[key] === "number"
        ? [{ day: c.day, value: c[key] as number }]
        : [],
    );
  }
  return analyzePatterns({ today, starts: data.starts, series });
}

// Everything the refresh reads, condensed to one string: when it changes the
// engine runs again, otherwise nothing is recomputed.
export async function engineSignature(
  db: LocalDb,
  today: string,
  hideWeight = false,
  nutritionMode: NutritionMode = "off",
): Promise<string> {
  const tables = [
    "workouts",
    "workout_exercises",
    "workout_sets",
    "checkins",
    "cycle_events",
    ...(hideWeight ? [] : (["bodyweight_entries"] as const)),
    ...(nutritionMode === "off" ? [] : (["food_logs"] as const)),
  ] as const;
  // count + newest write, both from the updated_at index: no table scans
  const parts = await Promise.all(
    tables.map(async (t) => {
      const last = await db[t].orderBy("updated_at").last();
      return `${await db[t].count()}:${(last as { updated_at?: string } | undefined)?.updated_at ?? ""}`;
    }),
  );
  return `${today}|${parts.join("|")}`;
}
