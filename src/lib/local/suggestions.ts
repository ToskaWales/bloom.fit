import { addDays, localDay } from "@/lib/daily/day";
import { buildCandidates } from "@/lib/engine";
import type { ExerciseSession } from "@/lib/engine/plateau";
import type { ReadinessCheckin } from "@/lib/engine/readiness";
import { selectSuggestions, type PastSuggestion } from "@/lib/engine/select";
import { deterministicUuid } from "@/lib/ids";
import { estimateOneRepMax } from "@/lib/workout/stats";
import type { LocalDb } from "./db";
import { patchRow, saveRow } from "./repo";
import type {
  CheckinRow,
  SetRow,
  SuggestionRow,
  SuggestionStatus,
  WorkoutExerciseRow,
  WorkoutRow,
} from "./types";

const HISTORY_DAYS = 40; // check-ins the engine looks at (baseline is 28 days)
const PAST_DAYS = 30; // earlier suggestions, for cooldowns
const SESSION_DAYS = 400;

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
  ).filter((w) => !w.deleted_at);
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
    if (s.deleted_at || !s.completed || s.set_type === "warmup") continue;
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
  /** A safety notice is active (set by the safety rules): never suggest doing more. */
  safetyFlag?: boolean;
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

async function doRefresh(
  db: LocalDb,
  { userId, today, safetyFlag = false }: RefreshOptions,
): Promise<void> {
  const checkins = (
    (await db.checkins
      .where("day")
      .between(addDays(today, -HISTORY_DAYS), today, true, true)
      .toArray()) as CheckinRow[]
  )
    .filter((c) => !c.deleted_at)
    .map<ReadinessCheckin>((c) => ({
      day: c.day,
      energy: c.energy,
      motivation: c.motivation,
      sleep_quality: c.sleep_quality,
    }));
  const exerciseSessions = await exerciseSessionsFromDb(db, today);

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
    buildCandidates({ today, checkins, exerciseSessions, safetyFlag }),
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
      if (
        row &&
        !row.deleted_at &&
        JSON.stringify(row.params) === JSON.stringify(c.params)
      )
        continue; // unchanged
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
    // a hint the data no longer supports (e.g. today's check-in was removed) goes away unless she reacted to it
    for (const row of existing.values()) {
      if (!keep.has(row.id) && !row.deleted_at && row.status === "shown") {
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
