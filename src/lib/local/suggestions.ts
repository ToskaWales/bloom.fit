// Glue between the local database and the pure adaptation engine (src/lib/engine):
// asks the engine for hints (using the data from engine-data.ts) and stores
// today's hints as `suggestions` rows. The rules and wording live in the engine,
// not here. Runs only on the device; only kind, subject, a few numbers and her
// reaction are stored.
import { summarizeCycle } from "@/lib/daily/cycle";
import { addDays } from "@/lib/daily/day";
import { buildCandidates } from "@/lib/engine";
import { detectHungerRise } from "@/lib/engine/hunger";
import { performanceSeries } from "@/lib/engine/performance";
import { evaluateEnergyNote, evaluateSafety } from "@/lib/engine/safety";
import type { ReadinessCheckin } from "@/lib/engine/readiness";
import { selectSuggestions, type PastSuggestion } from "@/lib/engine/select";
import { deterministicUuid } from "@/lib/ids";
import type { NutritionMode } from "@/components/local-provider";
import type { LocalDb } from "./db";
import { loadEngineData, patternsFrom } from "./engine-data";
import { patchRow, saveRow } from "./repo";
import type { SuggestionRow, SuggestionStatus } from "./types";

const HISTORY_DAYS = 40; // check-ins the engine looks at (baseline is 28 days)
const PAST_DAYS = 30; // earlier suggestions, for cooldowns

// Engine kinds the refresh owns: it may remove its own stale hints, never others.
const OWNED_KINDS = new Set([
  "readiness",
  "plateau",
  "pattern",
  "safety",
  "hunger_note",
]);

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

// Per-database promise chain, used by refreshSuggestions to run one refresh at a time.
const queues = new WeakMap<LocalDb, Promise<unknown>>();

interface RefreshOptions {
  userId: string;
  today: string;
  /** Cycle tracking mode: patterns and the safety rules need logged periods. */
  cycleMode?: "natural" | "hormonal" | "irregular" | "none" | null;
  /** Weight is never read when she hides it. */
  hideWeight?: boolean;
  /** Food entries are only read when nutrition is on. */
  nutritionMode?: NutritionMode;
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
  {
    userId,
    today,
    cycleMode = null,
    hideWeight = false,
    nutritionMode = "off",
  }: RefreshOptions,
): Promise<void> {
  const data = await loadEngineData(db, today, hideWeight, nutritionMode);
  const tracksCycle = cycleMode === "natural" || cycleMode === "irregular";
  const safety = tracksCycle
    ? evaluateSafety({
        today,
        cycle: summarizeCycle(data.cycleEvents, today),
        checkins: data.checkins,
        weights: hideWeight ? null : data.weights,
        intake: data.intake,
      })
    : null;
  const patterns = tracksCycle ? patternsFrom(data, today) : null;
  // Without a period signal, careful intake logging can raise the same calm notice.
  const energyNote =
    (!tracksCycle || data.starts.length === 0) && data.intake
      ? evaluateEnergyNote({
          today,
          checkins: data.checkins,
          intake: data.intake,
          trainingDays: data.trainingDays,
        })
      : null;

  // Removed hints count for the cooldown too: a note that disappeared again
  // after her next check-in was still shown once, and must not come back tomorrow.
  const pastRows = (await db.suggestions
    .where("day")
    .between(addDays(today, -PAST_DAYS), today, true, true)
    .toArray()) as SuggestionRow[];
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
      energyNote,
      // only hunger ratings, training days and training performance: never weight or food entries
      hunger: detectHungerRise({
        today,
        checkins: data.checkins.map((c) => ({ day: c.day, hunger: c.hunger })),
        trainingDays: data.trainingDays,
        performance: performanceSeries(data.exerciseSessions),
      }),
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

// Today's live hints, including ones she already reacted to.
export async function suggestionsForDay(
  db: LocalDb,
  day: string,
): Promise<SuggestionRow[]> {
  return (
    (await db.suggestions.where("day").equals(day).toArray()) as SuggestionRow[]
  ).filter((r) => !r.deleted_at);
}

// Stores her reaction (accepted/dismissed). The server refuses to turn it back
// into "shown" (trigger suggestions_keep_reaction), so a stale device cannot undo it.
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
