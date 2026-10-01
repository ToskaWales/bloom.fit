import type { DirtyRow, LocalStore, SyncRow, SyncTable } from './types';

type Entry = { row: SyncRow; dirty: boolean; version: number; failed: boolean };

/** In-Memory-Implementierung des LocalStore (Tests; gleiche Semantik wie der SQLite-Store). */
export class MemoryStore implements LocalStore {
  tables: Record<SyncTable, Map<string, Entry>> = {
    exercises: new Map(),
    workouts: new Map(),
    workout_exercises: new Map(),
    sets: new Map(),
  };
  meta = new Map<string, string>();
  private clock = 0;

  async writeLocal(table: SyncTable, row: SyncRow) {
    const existing = this.tables[table].get(row.id);
    this.clock += 1;
    this.tables[table].set(row.id, {
      row: { ...row, updated_at: row.updated_at ?? `local-${this.clock}` },
      dirty: true,
      version: (existing?.version ?? 0) + 1,
      failed: false,
    });
  }

  async getDirty(table: SyncTable): Promise<DirtyRow[]> {
    return [...this.tables[table].values()]
      .filter((e) => e.dirty && !e.failed)
      .map((e) => ({ row: { ...e.row }, version: e.version }));
  }

  async markClean(table: SyncTable, id: string, version: number) {
    const entry = this.tables[table].get(id);
    if (entry && entry.version === version) entry.dirty = false;
  }

  async markFailed(table: SyncTable, ids: string[]) {
    for (const id of ids) {
      const entry = this.tables[table].get(id);
      if (entry) entry.failed = true;
    }
  }

  async applyRemote(table: SyncTable, rows: SyncRow[]) {
    for (const row of rows) {
      const existing = this.tables[table].get(row.id);
      if (existing?.dirty) continue;
      this.tables[table].set(row.id, {
        row: { ...row },
        dirty: false,
        version: existing?.version ?? 0,
        failed: false,
      });
    }
  }

  async getMeta(key: string) {
    return this.meta.get(key) ?? null;
  }

  async setMeta(key: string, value: string) {
    this.meta.set(key, value);
  }

  get(table: SyncTable, id: string) {
    return this.tables[table].get(id);
  }
}
