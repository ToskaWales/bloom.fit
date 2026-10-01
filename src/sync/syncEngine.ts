import { isPushable, normalizeForPush } from './tables';
import { SYNC_TABLES, SyncError, type LocalStore, type RemoteApi, type SyncRow } from './types';

export type SyncResult = { pushed: number; pulled: number; quarantined: number };

const PUSH_CHUNK = 200;
const PULL_PAGE = 1000;

const cursorKey = (table: string) => `pull:${table}`;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Anzahl lokaler Änderungen, die noch auf den Server warten (für die Statusanzeige). */
export async function countPending(store: LocalStore): Promise<number> {
  let total = 0;
  for (const table of SYNC_TABLES) {
    const dirty = await store.getDirty(table);
    total += dirty.filter((d) => isPushable(table, d.row)).length;
  }
  return total;
}

/**
 * Push (Eltern vor Kindern), danach Pull. Wirft bei Netzwerk-/Serverfehlern; lokale Daten bleiben dann
 * unverändert „dirty" und werden beim nächsten Versuch erneut gesendet. Abgelehnte Zeilen
 * (Constraint/RLS) werden in Quarantäne gelegt, damit sie die übrigen nicht blockieren.
 */
export async function syncAll(store: LocalStore, remote: RemoteApi): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, quarantined: 0 };

  for (const table of SYNC_TABLES) {
    const dirty = (await store.getDirty(table)).filter((d) => isPushable(table, d.row));
    for (const batch of chunks(dirty, PUSH_CHUNK)) {
      try {
        await remote.upsert(
          table,
          batch.map((d) => normalizeForPush(table, d.row)),
        );
      } catch (error) {
        if (error instanceof SyncError && !error.retryable) {
          await store.markFailed(
            table,
            batch.map((d) => d.row.id),
          );
          result.quarantined += batch.length;
          continue;
        }
        throw error;
      }
      for (const d of batch) await store.markClean(table, d.row.id, d.version);
      result.pushed += batch.length;
    }
  }

  for (const table of SYNC_TABLES) {
    let cursor = await store.getMeta(cursorKey(table));
    for (;;) {
      const rows = await remote.fetchSince(table, cursor, PULL_PAGE);
      if (rows.length > 0) {
        await store.applyRemote(table, rows);
        result.pulled += rows.length;
      }
      const newest = latestUpdatedAt(rows);
      const advanced = newest !== null && newest !== cursor;
      if (advanced) {
        cursor = newest;
        await store.setMeta(cursorKey(table), newest);
      }
      // Letzte Seite oder kein Fortschritt (volle Seite mit identischem Zeitstempel): fertig.
      if (rows.length < PULL_PAGE || !advanced) break;
    }
  }
  return result;
}

function latestUpdatedAt(rows: SyncRow[]): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    if (row.updated_at && (latest === null || row.updated_at > latest)) latest = row.updated_at;
  }
  return latest;
}
