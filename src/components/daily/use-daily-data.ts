"use client";

// Live-query hooks over the local database for cycle events and weights (soft-deleted rows excluded).
// Used by the cycle and weight cards and screens. Return undefined while the database opens, so UIs can show 'loading'.
// No server access. Neighbours: local-provider.tsx (useLocal), lib/daily.

import { useLiveQuery } from "dexie-react-hooks";
import { useLocal } from "@/components/local-provider";
import type { CycleEvent } from "@/lib/daily/cycle";
import type { WeightPoint } from "@/lib/daily/weight";
import type { CycleEventRow, WeightRow } from "@/lib/local/types";

// undefined while the local database is still opening.
export function useCycleEvents(): CycleEvent[] | undefined {
  const { db } = useLocal();
  return useLiveQuery(async () => {
    if (!db) return undefined;
    const rows = (await db.cycle_events
      .filter((e) => !e.deleted_at)
      .toArray()) as CycleEventRow[];
    return rows.map((r) => ({ kind: r.kind, day: r.day }));
  }, [db]);
}

// Returns [] (not undefined) when weight is hidden, so no component ever sees weight values in that mode.
export function useWeights(): WeightPoint[] | undefined {
  const { db, hideWeight } = useLocal();
  return useLiveQuery(async () => {
    if (!db) return undefined;
    if (hideWeight) return [];
    const rows = (await db.bodyweight_entries
      .filter((e) => !e.deleted_at)
      .toArray()) as WeightRow[];
    return rows.map((r) => ({ day: r.day, kg: Number(r.weight_kg) }));
  }, [db, hideWeight]);
}
