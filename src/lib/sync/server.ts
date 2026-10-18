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

const SAFETY_WINDOW_MS = 10_000;

export interface RunSyncOptions {
  now?: () => Date;
}

// Pulls are idempotent for clients, so re-delivering rows is harmless; see nextCursor.
export async function runSync(
  db: SyncDb,
  userId: string,
  request: SyncRequest,
  options: RunSyncOptions = {},
): Promise<SyncResponse> {
  const now = options.now ?? (() => new Date());
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
    if (valid.length) {
      try {
        await db.upsert(table, userId, valid);
      } catch {
        // One bad row must not block the rest of the batch (or every later sync).
        for (const row of valid) {
          try {
            await db.upsert(table, userId, [row]);
          } catch {
            rejected.push({ table, id: String(row.id), reason: "db" });
          }
        }
      }
    }
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
    cursors[table] = nextCursor(
      request.cursors[table] ?? null,
      page,
      rows.length > PULL_LIMIT,
      now(),
    );
  }
  return { pulled, cursors, hasMore, rejected };
}

// A row is stamped before its transaction commits, so a row stamped at t can
// become visible after another device already pulled past t. Holding the cursor
// back by a safety window re-delivers recent rows (harmless: applying is
// idempotent) instead of skipping them. A full page advances normally, and a
// cursor never moves backwards.
function nextCursor(
  previous: string | null,
  page: WireRow[],
  full: boolean,
  now: Date,
): string | null {
  if (page.length === 0) return previous;
  const last = page[page.length - 1].updated_at ?? null;
  if (!last) return previous;
  const limit = new Date(now.getTime() - SAFETY_WINDOW_MS).toISOString();
  const candidate = full || last < limit ? last : limit;
  return previous && previous > candidate ? previous : candidate;
}
