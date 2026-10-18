import type { SyncDb } from "./server";
import type { TableName, WireRow } from "./tables";

// In-memory stand-in for the server database (test only).
export function memoryDb() {
  const rows: Record<string, (WireRow & { user_id: string })[]> = {};
  let clock = 0;
  const db: SyncDb = {
    async upsert(table, userId, incoming) {
      const list = (rows[table] ??= []);
      for (const r of incoming) {
        // ids are unique per user (primary key is (user_id, id))
        const idx = list.findIndex(
          (x) => x.id === r.id && x.user_id === userId,
        );
        const stamped = {
          ...r,
          user_id: userId,
          updated_at: new Date(
            Date.UTC(2026, 10, 1, 0, 0, ++clock),
          ).toISOString(),
        } as WireRow & { user_id: string };
        if (idx >= 0) list[idx] = stamped;
        else list.push(stamped);
      }
    },
    async pull(table: TableName, userId, cursor, limit) {
      return (rows[table] ?? [])
        .filter(
          (r) => r.user_id === userId && (!cursor || r.updated_at! >= cursor),
        )
        .sort((a, b) => a.updated_at!.localeCompare(b.updated_at!))
        .slice(0, limit);
    },
  };
  return { db, rows };
}
