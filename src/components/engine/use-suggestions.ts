"use client";

// Hooks that run the pure engine (lib/engine) against the local database and return today's stored hints.
// Used by suggestions-card.tsx and session-hint.tsx; the engine itself runs on the device; only the resulting hint rows (kind,
// subject, a few numbers, her reaction) are stored like any other row and sync later.
// Neighbours: lib/local/suggestions (storage + refresh), use-today.ts for the day argument.

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { useLocal } from "@/components/local-provider";
import { addDays } from "@/lib/daily/day";
import { computeReadiness, type ReadinessPart } from "@/lib/engine/readiness";
import { engineSignature } from "@/lib/local/engine-data";
import { refreshSuggestions, suggestionsForDay } from "@/lib/local/suggestions";
import type { CheckinRow, SuggestionRow } from "@/lib/local/types";

// Re-runs the on-device engine whenever the data it reads changes (check-ins,
// workouts, cycle events, weight) and returns today's hints (undefined while
// the database opens).
export function useSuggestions(
  today: string,
  { refresh = true }: { refresh?: boolean } = {},
): SuggestionRow[] | undefined {
  const { db, userId, cycleMode, hideWeight, nutritionMode } = useLocal();

  // A cheap fingerprint of the inputs the engine reads; the effect below only re-runs the engine when it changes, not on every render.
  const signature = useLiveQuery(
    async () =>
      db && today
        ? await engineSignature(db, today, hideWeight, nutritionMode)
        : undefined,
    [db, today, hideWeight, nutritionMode],
  );

  useEffect(() => {
    if (refresh && db && today && signature !== undefined)
      void refreshSuggestions(db, {
        userId,
        today,
        cycleMode,
        hideWeight,
        nutritionMode,
      }).catch(() => {});
  }, [
    refresh,
    db,
    userId,
    today,
    signature,
    cycleMode,
    hideWeight,
    nutritionMode,
  ]);

  return useLiveQuery(
    async () => (db && today ? await suggestionsForDay(db, today) : undefined),
    [db, today],
  );
}

// Today's readiness numbers, recomputed locally for the "why" lines: the stored
// hint only keeps the level, not her check-in values.
export function useReadinessParts(today: string): ReadinessPart[] | undefined {
  const { db } = useLocal();
  return useLiveQuery(async () => {
    if (!db || !today) return undefined;
    const rows = (
      (await db.checkins
        .where("day")
        .between(addDays(today, -40), today, true, true)
        .toArray()) as CheckinRow[]
    ).filter((c) => !c.deleted_at);
    const r = computeReadiness(today, rows);
    return r.status === "ready" ? r.parts : [];
  }, [db, today]);
}
