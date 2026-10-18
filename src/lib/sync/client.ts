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
      if (body.rejected?.length)
        await db.meta.put({
          key: "rejected",
          value: JSON.stringify(body.rejected),
        });
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
