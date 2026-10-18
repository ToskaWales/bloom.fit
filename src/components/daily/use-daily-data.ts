"use client";

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
