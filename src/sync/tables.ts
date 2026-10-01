import type { SyncRow, SyncTable } from './types';

const AUDIT = ['created_at', 'updated_at'];

/** Spalten je Tabelle (lokal gespiegelt). */
export const TABLE_COLUMNS: Record<SyncTable, string[]> = {
  exercises: ['id', 'user_id', 'name', 'aliases', ...AUDIT],
  workouts: [
    'id',
    'user_id',
    'performed_on',
    'started_at',
    'ended_at',
    'notes',
    'deleted_at',
    ...AUDIT,
  ],
  workout_exercises: [
    'id',
    'user_id',
    'workout_id',
    'exercise_id',
    'position',
    'deleted_at',
    ...AUDIT,
  ],
  sets: [
    'id',
    'user_id',
    'workout_exercise_id',
    'set_index',
    'weight_kg',
    'reps',
    'rpe',
    'is_warmup',
    'deleted_at',
    ...AUDIT,
  ],
};

/**
 * Unvollständige Sätze (Gewicht/Wiederholungen fehlen) bleiben lokal, bis sie komplett sind – der Server
 * verlangt gültige Werte. Gelöschte Sätze (Tombstones) werden immer gepusht.
 */
export function isPushable(table: SyncTable, row: SyncRow): boolean {
  if (table !== 'sets' || row.deleted_at) return true;
  const weight = row.weight_kg as number | null | undefined;
  const reps = row.reps as number | null | undefined;
  return weight != null && weight >= 0 && reps != null && reps >= 1;
}

/** Payload für den Server: Audit-Spalten setzt der Server; Tombstones bekommen gültige Platzhalterwerte. */
export function normalizeForPush(table: SyncTable, row: SyncRow): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const column of TABLE_COLUMNS[table]) {
    if (AUDIT.includes(column)) continue;
    payload[column] = row[column] ?? null;
  }
  if (table === 'sets' && row.deleted_at) {
    payload.weight_kg = row.weight_kg ?? 0;
    payload.reps = typeof row.reps === 'number' && row.reps >= 1 ? row.reps : 1;
  }
  if (table === 'exercises' && payload.aliases == null) payload.aliases = [];
  return payload;
}
