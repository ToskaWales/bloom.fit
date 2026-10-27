// The single door for writing synced rows locally. Every change goes through here
// so that "update the row" and "queue it for upload" always happen in ONE
// transaction (no row can change without being queued). Feature logic lives in the
// neighbouring files (workouts.ts, daily.ts, ...); uploading lives in src/lib/sync/client.ts.
import type { TableName, WireRow } from "@/lib/sync/tables";
import type { LocalDb } from "./db";

// Every local write also queues the row for sync, atomically. updated_at is
// stamped here only for local ordering/indexes; the server assigns its own value.
export async function saveRow(
  db: LocalDb,
  table: TableName,
  row: WireRow,
): Promise<void> {
  const stamped = { ...row, updated_at: new Date().toISOString() };
  await db.transaction("rw", db[table], db.outbox, async () => {
    await db[table].put(stamped);
    await db.outbox.add({ table, id: row.id });
  });
}

// // Deleting means setting deleted_at (a "tombstone"), never removing the row: the
// // tombstone is what tells the server and the other devices that it is gone.
// // Unknown ids are ignored.
export async function softDelete(
  db: LocalDb,
  table: TableName,
  id: string,
): Promise<void> {
  const row = await db[table].get(id);
  if (!row) return;
  await saveRow(db, table, { ...row, deleted_at: new Date().toISOString() });
}

// // Soft-deletes a workout together with all its exercises and sets in one
// // transaction, so a sync can never see a workout whose children are still alive.
// // Rows that were already deleted keep their original deleted_at.
export async function softDeleteWorkout(
  db: LocalDb,
  workoutId: string,
): Promise<void> {
  await db.transaction(
    "rw",
    [db.workouts, db.workout_exercises, db.workout_sets, db.outbox],
    async () => {
      const now = new Date().toISOString();
      const exercises = await db.workout_exercises
        .where("workout_id")
        .equals(workoutId)
        .toArray();
      for (const ex of exercises) {
        const sets = await db.workout_sets
          .where("workout_exercise_id")
          .equals(ex.id)
          .toArray();
        for (const s of sets)
          await saveRow(db, "workout_sets", {
            ...s,
            deleted_at: s.deleted_at ?? now,
          });
        await saveRow(db, "workout_exercises", {
          ...ex,
          deleted_at: ex.deleted_at ?? now,
        });
      }
      const w = await db.workouts.get(workoutId);
      if (w)
        await saveRow(db, "workouts", {
          ...w,
          deleted_at: w.deleted_at ?? now,
        });
    },
  );
}

// Atomic read-modify-write: two quick edits of different fields (an input
// blurring while a button is tapped) must both survive.
export async function patchRow<T extends WireRow>(
  db: LocalDb,
  table: TableName,
  id: string,
  patch: (row: T) => T,
): Promise<void> {
  await db.transaction("rw", db[table], db.outbox, async () => {
    const row = (await db[table].get(id)) as T | undefined;
    if (!row) return;
    const next = { ...patch(row), updated_at: new Date().toISOString() };
    await db[table].put(next);
    await db.outbox.add({ table, id });
  });
}

// Bulk variant of saveRow: one transaction, rows queued for sync parents-first
// (the table order given by `order`).
export async function saveRows(
  db: LocalDb,
  items: { table: TableName; row: WireRow }[],
  order: readonly TableName[],
): Promise<void> {
  const stamp = new Date().toISOString();
  await db.transaction(
    "rw",
    [...order.map((t) => db[t]), db.outbox],
    async () => {
      for (const table of order) {
        const rows = items
          .filter((i) => i.table === table)
          .map((i) => ({ ...i.row, updated_at: stamp }));
        if (!rows.length) continue;
        await db[table].bulkPut(rows);
        await db.outbox.bulkAdd(rows.map((r) => ({ table, id: r.id })));
      }
    },
  );
}
