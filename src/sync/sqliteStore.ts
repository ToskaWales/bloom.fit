import * as SQLite from 'expo-sqlite';
import { TABLE_COLUMNS } from './tables';
import { SYNC_TABLES, type DirtyRow, type LocalStore, type SyncRow, type SyncTable } from './types';

// Lokale Spiegel der Training-Tabellen. Zusatzspalten: dirty (noch nicht gepusht), local_version
// (zählt lokale Änderungen, schützt vor Races beim Push), sync_failed (vom Server abgelehnt).
const SCHEMA_VERSION = 1;

const DDL = `
create table if not exists exercises (
  id text primary key, user_id text, name text not null, aliases text not null default '[]',
  created_at text, updated_at text,
  dirty integer not null default 0, local_version integer not null default 0, sync_failed integer not null default 0
);
create table if not exists workouts (
  id text primary key, user_id text, performed_on text not null, started_at text, ended_at text, notes text,
  deleted_at text, created_at text, updated_at text,
  dirty integer not null default 0, local_version integer not null default 0, sync_failed integer not null default 0
);
create table if not exists workout_exercises (
  id text primary key, user_id text, workout_id text not null, exercise_id text not null, position integer not null,
  deleted_at text, created_at text, updated_at text,
  dirty integer not null default 0, local_version integer not null default 0, sync_failed integer not null default 0
);
create table if not exists sets (
  id text primary key, user_id text, workout_exercise_id text not null, set_index integer not null,
  weight_kg real, reps integer, rpe real, is_warmup integer not null default 0,
  deleted_at text, created_at text, updated_at text,
  dirty integer not null default 0, local_version integer not null default 0, sync_failed integer not null default 0
);
create index if not exists idx_workouts_date on workouts (performed_on);
create index if not exists idx_we_workout on workout_exercises (workout_id);
create index if not exists idx_we_exercise on workout_exercises (exercise_id);
create index if not exists idx_sets_we on sets (workout_exercise_id);
create table if not exists sync_meta (key text primary key, value text not null);
`;

export const dbNameForUser = (userId: string) => `bloom-${userId}.db`;

export async function openLocalDb(userId: string): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(dbNameForUser(userId));
  await db.execAsync('pragma journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('pragma user_version');
  if ((row?.user_version ?? 0) < SCHEMA_VERSION) {
    await db.execAsync(DDL);
    await db.execAsync(`pragma user_version = ${SCHEMA_VERSION};`);
  }
  return db;
}

/** Löscht die lokale Datenbank einer Nutzerin (z. B. nach Account-Löschung). */
export async function deleteLocalDb(userId: string): Promise<void> {
  await SQLite.deleteDatabaseAsync(dbNameForUser(userId)).catch(() => {});
}

type DbRow = Record<string, unknown>;

function toDb(row: SyncRow, table: SyncTable): unknown[] {
  return TABLE_COLUMNS[table].map((column) => {
    const value = row[column];
    if (value === undefined || value === null) return null;
    if (column === 'aliases') return JSON.stringify(value);
    if (column === 'is_warmup') return value ? 1 : 0;
    return value as string | number;
  });
}

export function fromDb(table: SyncTable, raw: DbRow): SyncRow {
  const row: SyncRow = { id: raw.id as string };
  for (const column of TABLE_COLUMNS[table]) {
    const value = raw[column] ?? null;
    if (column === 'aliases') row[column] = value ? JSON.parse(value as string) : [];
    else if (column === 'is_warmup') row[column] = !!value;
    else row[column] = value;
  }
  return row;
}

export class SqliteStore implements LocalStore {
  constructor(readonly db: SQLite.SQLiteDatabase) {}

  async writeLocal(table: SyncTable, row: SyncRow) {
    const now = new Date().toISOString();
    const full: SyncRow = { ...row, created_at: row.created_at ?? now, updated_at: now };
    const columns = TABLE_COLUMNS[table];
    const updates = columns
      .filter((c) => c !== 'id' && c !== 'created_at')
      .map((c) => `${c} = excluded.${c}`);
    await this.db.runAsync(
      `insert into ${table} (${columns.join(', ')}, dirty, local_version, sync_failed)
       values (${columns.map(() => '?').join(', ')}, 1, 1, 0)
       on conflict(id) do update set ${updates.join(', ')}, dirty = 1, sync_failed = 0,
         local_version = ${table}.local_version + 1`,
      toDb(full, table) as SQLite.SQLiteBindValue[],
    );
  }

  async getDirty(table: SyncTable): Promise<DirtyRow[]> {
    const rows = await this.db.getAllAsync<DbRow>(
      `select * from ${table} where dirty = 1 and sync_failed = 0`,
    );
    return rows.map((r) => ({ row: fromDb(table, r), version: r.local_version as number }));
  }

  async markClean(table: SyncTable, id: string, version: number) {
    await this.db.runAsync(`update ${table} set dirty = 0 where id = ? and local_version = ?`, [
      id,
      version,
    ]);
  }

  async markFailed(table: SyncTable, ids: string[]) {
    for (const id of ids)
      await this.db.runAsync(`update ${table} set sync_failed = 1 where id = ?`, [id]);
  }

  async applyRemote(table: SyncTable, rows: SyncRow[]) {
    const columns = TABLE_COLUMNS[table];
    const updates = columns.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
    const sql = `insert into ${table} (${columns.join(', ')}, dirty, local_version, sync_failed)
      values (${columns.map(() => '?').join(', ')}, 0, 0, 0)
      on conflict(id) do update set ${updates.join(', ')} where ${table}.dirty = 0`;
    await this.db.withTransactionAsync(async () => {
      for (const row of rows)
        await this.db.runAsync(sql, toDb(row, table) as SQLite.SQLiteBindValue[]);
    });
  }

  async getMeta(key: string) {
    const row = await this.db.getFirstAsync<{ value: string }>(
      'select value from sync_meta where key = ?',
      [key],
    );
    return row?.value ?? null;
  }

  async setMeta(key: string, value: string) {
    await this.db.runAsync('insert or replace into sync_meta (key, value) values (?, ?)', [
      key,
      value,
    ]);
  }
}

export { SYNC_TABLES };
