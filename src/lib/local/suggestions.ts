import { summarizeCycle } from "@/lib/daily/cycle";
import { addDays, localDay } from "@/lib/daily/day";
import type { WeightPoint } from "@/lib/daily/weight";
import { buildCandidates } from "@/lib/engine";
import {
  analyzePatterns,
  type DayValue,
  type PatternAnalysis,
  type PatternMetric,
} from "@/lib/engine/patterns";
import { performanceSeries } from "@/lib/engine/performance";
import type { ExerciseSession } from "@/lib/engine/plateau";
import { evaluateSafety } from "@/lib/engine/safety";
import type { ReadinessCheckin } from "@/lib/engine/readiness";
import { selectSuggestions, type PastSuggestion } from "@/lib/engine/select";
import { deterministicUuid } from "@/lib/ids";
import { estimateOneRepMax } from "@/lib/workout/stats";
import type { LocalDb } from "./db";
import { patchRow, saveRow } from "./repo";
import type {
  CheckinRow,
  CycleEventRow,
  SetRow,
  SuggestionRow,
  SuggestionStatus,
  WeightRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from "./types";

const HISTORY_DAYS = 40; // check-ins the engine looks at (baseline is 28 days)
const PAST_DAYS = 30; // earlier suggestions, for cooldowns
const SESSION_DAYS = 200; // plateau looks 56 + 84 days back, patterns need a few earlier sessions
const PATTERN_DAYS = 200; // check-ins for pattern detection: a handful of cycles
const WEIGHT_DAYS = 60;

// Engine kinds the refresh owns: it may remove its own stale hints, never others.
const OWNED_KINDS = new Set(["readiness", "plateau", "pattern", "safety"]);

const sameParams = (a: SuggestionRow["params"], b: SuggestionRow["params"]) => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return (
    ka.length === kb.length &&
    ka.every(
      (k, i) => k === kb[i] && JSON.stringify(a[k]) === JSON.stringify(b[k]),
    )
  );
};

// Best estimated 1RM per exercise and workout, over the last year, from local data.
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

const queues = new WeakMap<LocalDb, Promise<unknown>>();

interface RefreshOptions {
  userId: string;
  today: string;
  /** Cycle tracking mode: patterns and the safety rules need logged periods. */
  cycleMode?: "natural" | "hormonal" | "irregular" | "none" | null;
  /** Weight is never read when she hides it. */
  hideWeight?: boolean;
}

// Runs the engine on this device's data and stores today's hints. Safe to call
// as often as you like: ids are derived from day + kind + subject, an existing
// reaction is never overwritten, and unchanged hints cause no writes. Calls on
// one database are serialized, so concurrent effects can't race each other.
export function refreshSuggestions(
  db: LocalDb,
  options: RefreshOptions,
): Promise<void> {
  const run = (queues.get(db) ?? Promise.resolve())
    .catch(() => {})
    .then(() => doRefresh(db, options));
  queues.set(db, run);
  return run;
}

const SERIES: { metric: PatternMetric; key: keyof CheckinRow }[] = [
  { metric: "energy", key: "energy" },
  { metric: "motivation", key: "motivation" },
  { metric: "sleep", key: "sleep_quality" },
  { metric: "hunger", key: "hunger" },
];

export interface EngineData {
  checkins: CheckinRow[];
  starts: string[];
  cycleEvents: CycleEventRow[];
  weights: WeightPoint[];
  exerciseSessions: Map<string, ExerciseSession[]>;
}

export async function loadEngineData(
  db: LocalDb,
  today: string,
  hideWeight = false,
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
  return {
    checkins,
    cycleEvents,
    starts: cycleEvents
      .filter((e) => e.kind === "period_start")
      .map((e) => e.day),
    weights,
    exerciseSessions: await exerciseSessionsFromDb(db, today),
  };
}

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
): Promise<string> {
  const tables = [
    "workouts",
    "workout_exercises",
    "workout_sets",
    "checkins",
    "cycle_events",
    ...(hideWeight ? [] : (["bodyweight_entries"] as const)),
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

async function doRefresh(
  db: LocalDb,
  { userId, today, cycleMode = null, hideWeight = false }: RefreshOptions,
): Promise<void> {
  const data = await loadEngineData(db, today, hideWeight);
  const tracksCycle = cycleMode === "natural" || cycleMode === "irregular";
  const safety = tracksCycle
    ? evaluateSafety({
        today,
        cycle: summarizeCycle(data.cycleEvents, today),
        checkins: data.checkins,
        weights: hideWeight ? null : data.weights,
      })
    : null;
  const patterns = tracksCycle ? patternsFrom(data, today) : null;

  const pastRows = (
    (await db.suggestions
      .where("day")
      .between(addDays(today, -PAST_DAYS), today, true, true)
      .toArray()) as SuggestionRow[]
  ).filter((r) => !r.deleted_at);
  const past: PastSuggestion[] = pastRows.map((r) => ({
    kind: r.kind,
    subject: r.subject,
    day: r.day,
    status: r.status,
  }));

  const selected = selectSuggestions(
    buildCandidates({
      today,
      checkins: data.checkins
        .filter((c) => c.day >= addDays(today, -HISTORY_DAYS))
        .map<ReadinessCheckin>((c) => ({
          day: c.day,
          energy: c.energy,
          motivation: c.motivation,
          sleep_quality: c.sleep_quality,
        })),
      exerciseSessions: data.exerciseSessions,
      patterns,
      safety,
    }),
    past,
    today,
  );
  // ids first: async crypto must not happen inside the database transaction
  const wanted = await Promise.all(
    selected.map(async (c) => ({
      c,
      id: await deterministicUuid(
        `${userId}|suggestion|${today}|${c.kind}|${c.subject}`,
      ),
    })),
  );

  await db.transaction("rw", db.suggestions, db.outbox, async () => {
    const existing = new Map(
      (
        (await db.suggestions
          .where("day")
          .equals(today)
          .toArray()) as SuggestionRow[]
      ).map((r) => [r.id, r]),
    );
    const keep = new Set(wanted.map((w) => w.id));

    for (const { c, id } of wanted) {
      const row = existing.get(id);
      if (row && !row.deleted_at && sameParams(row.params, c.params)) continue; // unchanged
      await saveRow(db, "suggestions", {
        id,
        kind: c.kind,
        day: today,
        subject: c.subject,
        params: c.params,
        status: row && !row.deleted_at ? row.status : "shown", // keep her reaction
        reacted_at: row && !row.deleted_at ? row.reacted_at : null,
        deleted_at: null,
      } satisfies SuggestionRow);
    }
    // a hint the data no longer supports goes away, unless she reacted to it or it is not the engine's
    for (const row of existing.values()) {
      if (
        !keep.has(row.id) &&
        !row.deleted_at &&
        row.status === "shown" &&
        OWNED_KINDS.has(row.kind)
      ) {
        await saveRow(db, "suggestions", {
          ...row,
          deleted_at: new Date().toISOString(),
        });
      }
    }
  });
}

export async function suggestionsForDay(
  db: LocalDb,
  day: string,
): Promise<SuggestionRow[]> {
  return (
    (await db.suggestions.where("day").equals(day).toArray()) as SuggestionRow[]
  ).filter((r) => !r.deleted_at);
}

export async function reactToSuggestion(
  db: LocalDb,
  id: string,
  status: Exclude<SuggestionStatus, "shown">,
): Promise<void> {
  await patchRow<SuggestionRow>(db, "suggestions", id, (row) => ({
    ...row,
    status,
    reacted_at: new Date().toISOString(),
  }));
}
