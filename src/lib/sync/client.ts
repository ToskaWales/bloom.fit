import type { LocalDb } from "@/lib/local/db";
import {
  MAX_ROWS_PER_TABLE,
  TABLES,
  type SyncResponse,
  type TableName,
} from "./tables";

export type SyncResult =
  | { status: "ok"; pushed: number; pulled: number }
  | { status: "unauthorized" }
  | { status: "error"; message: string };

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const cursorKey = (t: TableName) => `cursor:${t}`;

// One round: push everything queued, then pull until caught up.
// The outbox is only cleared after the server confirmed the push, and a
// replayed push is harmless (server upserts by id), so a crash or lost
// response at any point cannot lose or duplicate data.
export async function syncOnce(
  db: LocalDb,
  fetcher: Fetcher = fetch,
): Promise<SyncResult> {
  let pushed = 0;
  let pulledCount = 0;
  try {
    for (let round = 0; round < 50; round++) {
      const queued = await db.outbox
        .orderBy("seq")
        .limit(MAX_ROWS_PER_TABLE)
        .toArray();
      const push: Record<string, unknown[]> = {};
      const sentSeqs: number[] = [];
      const seen = new Set<string>();
      for (const entry of queued) {
        sentSeqs.push(entry.seq!);
        const key = `${entry.table}:${entry.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const row = await db[entry.table].get(entry.id);
        if (row) (push[entry.table] ??= []).push(row);
      }

      const cursors: Record<string, string | null> = {};
      for (const t of TABLES)
        cursors[t] = (await db.meta.get(cursorKey(t)))?.value ?? null;

      const res = await fetcher("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push, cursors }),
      });
      if (res.status === 401) return { status: "unauthorized" };
      if (!res.ok) return { status: "error", message: `HTTP ${res.status}` };
      const body = (await res.json()) as SyncResponse;

      // Confirmed by the server: drop exactly what we sent (later edits have newer seqs).
      if (sentSeqs.length) await db.outbox.bulkDelete(sentSeqs);
      pushed += seen.size;
      await recordRejected(db, seen, body.rejected ?? []);
      pulledCount += await applyPulled(db, body);

      if (!body.hasMore && queued.length < MAX_ROWS_PER_TABLE) break;
    }
    return { status: "ok", pushed, pulled: pulledCount };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "network",
    };
  }
}

async function applyPulled(db: LocalDb, body: SyncResponse): Promise<number> {
  let applied = 0;
  await db.transaction(
    "rw",
    [...TABLES.map((t) => db[t]), db.outbox, db.meta],
    async () => {
      for (const t of TABLES) {
        for (const remote of body.pulled[t] ?? []) {
          // Local edits that haven't been pushed yet win; they overwrite the server copy on the next push.
          const pending = await db.outbox
            .where("[table+id]")
            .equals([t, remote.id])
            .count();
          if (pending > 0) continue;
          await db[t].put(remote);
          applied++;
        }
        if (body.cursors[t])
          await db.meta.put({ key: cursorKey(t), value: body.cursors[t] });
      }
    },
  );
  return applied;
}

export interface RejectedRow {
  table: TableName;
  id: string | null;
  reason: string;
}

export const REJECTED_KEY = "rejected";

// Rows the server refused stay listed (so the UI can warn about them) until a
// later push of the same row succeeds.
async function recordRejected(
  db: LocalDb,
  pushed: Set<string>,
  rejected: RejectedRow[],
): Promise<void> {
  const key = (r: RejectedRow) => `${r.table}:${r.id}`;
  const existing: RejectedRow[] = JSON.parse(
    (await db.meta.get(REJECTED_KEY))?.value ?? "[]",
  );
  const now = new Set(rejected.map(key));
  const kept = existing.filter((r) => !pushed.has(key(r)) || now.has(key(r)));
  const known = new Set(kept.map(key));
  const merged = [...kept, ...rejected.filter((r) => !known.has(key(r)))];
  if (merged.length)
    await db.meta.put({ key: REJECTED_KEY, value: JSON.stringify(merged) });
  else await db.meta.delete(REJECTED_KEY);
}

// Only one tab/worker syncs at a time; a second tab would otherwise push a
// stale copy of a row that the first tab just updated.
export async function syncWithLock(
  db: LocalDb,
  fetcher?: Fetcher,
): Promise<SyncResult> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return syncOnce(db, fetcher);
  const result = await locks.request(
    "bloom-sync",
    { ifAvailable: true },
    async (lock) => (lock ? syncOnce(db, fetcher) : null),
  );
  return result ?? { status: "ok", pushed: 0, pulled: 0 };
}
