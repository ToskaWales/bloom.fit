import Dexie, { type EntityTable } from "dexie";
import type { TableName, WireRow } from "@/lib/sync/tables";

export interface OutboxEntry {
  seq?: number;
  table: TableName;
  id: string;
}

export interface MetaEntry {
  key: string;
  value: string | null;
}

export type LocalDb = Dexie & {
  custom_exercises: EntityTable<WireRow, "id">;
  workouts: EntityTable<WireRow, "id">;
  workout_exercises: EntityTable<WireRow, "id">;
  workout_sets: EntityTable<WireRow, "id">;
  outbox: EntityTable<OutboxEntry, "seq">;
  meta: EntityTable<MetaEntry, "key">;
};

export function createLocalDb(name = "bloom"): LocalDb {
  const db = new Dexie(name) as LocalDb;
  db.version(1).stores({
    custom_exercises: "id, updated_at",
    workouts: "id, started_at, updated_at",
    workout_exercises: "id, workout_id, updated_at",
    workout_sets: "id, workout_exercise_id, updated_at",
    outbox: "++seq, [table+id]",
    meta: "key",
  });
  return db;
}
