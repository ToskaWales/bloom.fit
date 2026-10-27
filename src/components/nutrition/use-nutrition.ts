"use client";

// Live-query hooks over the local food tables: entries for a day, saved foods, recent entries.
// Pass an empty day to skip the query (used while nutrition is off). undefined means the database is still opening.
// Neighbours: nutrition-card.tsx, nutrition-view.tsx, foods-list.tsx, lib/local/nutrition.

import { useLiveQuery } from "dexie-react-hooks";
import { useLocal } from "@/components/local-provider";
import { listFoods, logsForDay, recentEntries } from "@/lib/local/nutrition";
import type { FoodLogRow, FoodRow } from "@/lib/local/types";

// undefined while the local database is opening.
export function useDayLogs(day: string): FoodLogRow[] | undefined {
  const { db } = useLocal();
  return useLiveQuery(
    async () => (db && day ? await logsForDay(db, day) : undefined),
    [db, day],
  );
}

export function useFoods(): FoodRow[] | undefined {
  const { db } = useLocal();
  return useLiveQuery(async () => (db ? await listFoods(db) : undefined), [db]);
}

export function useRecent(day: string): FoodLogRow[] | undefined {
  const { db } = useLocal();
  return useLiveQuery(
    async () => (db && day ? await recentEntries(db, day) : undefined),
    [db, day],
  );
}
