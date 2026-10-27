// The on-device database (IndexedDB via Dexie): one table per synced server table,
// holding rows in their "wire" shape, plus two local-only tables, `outbox` and `meta`.
// No reading/writing helpers live here (see repo.ts and the feature files) and no
// network code (see src/lib/sync/client.ts).
import Dexie, { type EntityTable } from "dexie";
import type { TableName, WireRow } from "@/lib/sync/tables";

// One pending upload: "row `id` of `table` changed and the server has not
// confirmed it yet". It stores only a pointer; the current row content is read
// at push time, so several edits of one row collapse into one upload.
export interface OutboxEntry {
  seq?: number;
  table: TableName;
  id: string;
}

// Small key/value store: per-table pull cursors ("cursor:<table>") and the list
// of rows the server rejected ("rejected"). Never synced.
export interface MetaEntry {
  key: string;
  value: string | null;
}

export type LocalDb = Dexie & {
  custom_exercises: EntityTable<WireRow, "id">;
  workouts: EntityTable<WireRow, "id">;
  workout_exercises: EntityTable<WireRow, "id">;
  workout_sets: EntityTable<WireRow, "id">;
  templates: EntityTable<WireRow, "id">;
  template_exercises: EntityTable<WireRow, "id">;
  checkins: EntityTable<WireRow, "id">;
  bodyweight_entries: EntityTable<WireRow, "id">;
  cycle_events: EntityTable<WireRow, "id">;
  suggestions: EntityTable<WireRow, "id">;
  foods: EntityTable<WireRow, "id">;
  food_logs: EntityTable<WireRow, "id">;
  outbox: EntityTable<OutboxEntry, "seq">;
  meta: EntityTable<MetaEntry, "key">;
};

// One database per signed-in user (local-provider.tsx passes "bloom-<userId>"; wipe.ts
// finds them by that prefix), so data of different accounts on a shared device never mixes.
// Never edit an existing version(n) block: devices upgrade step by step, so a
// change means a new version with only the stores/indexes that change. Only indexed
// fields are listed here; the other columns are stored as-is.
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
  db.version(2).stores({
    workout_exercises: "id, workout_id, exercise_id, updated_at",
    templates: "id, updated_at",
    template_exercises: "id, template_id, updated_at",
  });
  db.version(3).stores({
    checkins: "id, day, updated_at",
    bodyweight_entries: "id, day, updated_at",
    cycle_events: "id, day, kind, updated_at",
  });
  db.version(4).stores({
    suggestions: "id, day, kind, updated_at",
  });
  db.version(5).stores({
    foods: "id, barcode, updated_at",
    food_logs: "id, day, updated_at",
  });
  return db;
}
