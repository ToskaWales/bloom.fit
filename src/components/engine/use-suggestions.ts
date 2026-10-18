"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { useLocal } from "@/components/local-provider";
import { refreshSuggestions, suggestionsForDay } from "@/lib/local/suggestions";
import type { SuggestionRow } from "@/lib/local/types";

// Re-runs the on-device engine whenever today's check-in or the workout log
// changes, and returns today's hints (undefined while the database opens).
export function useSuggestions(today: string): SuggestionRow[] | undefined {
  const { db, userId } = useLocal();

  const signature = useLiveQuery(async () => {
    if (!db || !today) return undefined;
    const todays = await db.checkins.where("day").equals(today).toArray();
    return `${todays.map((c) => `${c.updated_at}${c.deleted_at ?? ""}`).join(",")}|${await db.workouts.count()}`;
  }, [db, today]);

  useEffect(() => {
    if (db && today && signature !== undefined)
      void refreshSuggestions(db, { userId, today }).catch(() => {});
  }, [db, userId, today, signature]);

  return useLiveQuery(
    async () => (db && today ? await suggestionsForDay(db, today) : undefined),
    [db, today],
  );
}
