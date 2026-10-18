import {
  MAX_ROWS_TOTAL,
  PULL_LIMIT,
  pushSchemas,
  TABLES,
  type SyncRequest,
  type SyncResponse,
  type TableName,
  type WireRow,
} from "./tables";

// Storage seam so the sync logic can be tested without a database.
export interface SyncDb {
  upsert(
    table: TableName,
    userId: string,
    rows: Record<string, unknown>[],
  ): Promise<void>;
  // Rows with updated_at >= cursor (or all), oldest first, at most `limit`.
  pull(
    table: TableName,
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<WireRow[]>;
}

export class SyncRequestError extends Error {}

// Cursors overlap slightly (>=) because commits can land out of timestamp
// order; clients apply pulled rows idempotently, so re-delivery is harmless.
export async function runSync(
  db: SyncDb,
  userId: string,
  request: SyncRequest,
): Promise<SyncResponse> {
  const known = new Set<string>(TABLES);
  for (const key of [
    ...Object.keys(request.push),
    ...Object.keys(request.cursors),
  ]) {
    if (!known.has(key)) throw new SyncRequestError(`unknown table: ${key}`);
  }
  const total = Object.values(request.push).reduce(
    (n, rows) => n + rows.length,
    0,
  );
  if (total > MAX_ROWS_TOTAL) throw new SyncRequestError("too many rows");

  const rejected: SyncResponse["rejected"] = [];
  for (const table of TABLES) {
    const rows = request.push[table] ?? [];
    const valid: Record<string, unknown>[] = [];
    for (const row of rows) {
      const parsed = pushSchemas[table].safeParse(row);
      if (parsed.success) valid.push(parsed.data);
      else {
        const rawId = (row as { id?: unknown })?.id;
        rejected.push({
          table,
          id: typeof rawId === "string" ? rawId : null,
          reason: "invalid",
        });
      }
    }
    if (valid.length) await db.upsert(table, userId, valid);
  }

  const pulled = {} as SyncResponse["pulled"];
  const cursors = {} as SyncResponse["cursors"];
  let hasMore = false;
  for (const table of TABLES) {
    const rows = await db.pull(
      table,
      userId,
      request.cursors[table] ?? null,
      PULL_LIMIT + 1,
    );
    if (rows.length > PULL_LIMIT) hasMore = true;
    const page = rows.slice(0, PULL_LIMIT);
    pulled[table] = page;
    cursors[table] = page.length
      ? (page[page.length - 1].updated_at ?? null)
      : (request.cursors[table] ?? null);
  }
  return { pulled, cursors, hasMore, rejected };
}
