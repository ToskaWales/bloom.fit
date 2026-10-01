// Offline-first Sync für das Training (E9): lokale Schreibzugriffe landen zuerst im LocalStore und
// werden später idempotent (Upsert per Client-UUID) an Supabase geschickt.

export const SYNC_TABLES = ['exercises', 'workouts', 'workout_exercises', 'sets'] as const;
/** Reihenfolge = Abhängigkeiten: Eltern vor Kindern (Fremdschlüssel auf dem Server). */
export type SyncTable = (typeof SYNC_TABLES)[number];

export type SyncRow = { id: string; updated_at?: string | null; [column: string]: unknown };

export type DirtyRow = {
  row: SyncRow;
  /** lokale Version zum Zeitpunkt des Lesens */ version: number;
};

export interface LocalStore {
  /** Lokale Änderung schreiben: Zeile wird als „dirty" markiert, Version steigt. */
  writeLocal(table: SyncTable, row: SyncRow): Promise<void>;
  /** Alle noch nicht synchronisierten Zeilen (ohne dauerhaft fehlgeschlagene). */
  getDirty(table: SyncTable): Promise<DirtyRow[]>;
  /** Nach erfolgreichem Push; nur wenn die Zeile seitdem nicht erneut geändert wurde. */
  markClean(table: SyncTable, id: string, version: number): Promise<void>;
  /** Dauerhaft abgelehnte Zeilen (z. B. Constraint-Verletzung) aus künftigen Pushes ausnehmen. */
  markFailed(table: SyncTable, ids: string[]): Promise<void>;
  /** Serverstand übernehmen; lokal noch nicht gepushte Änderungen haben Vorrang. */
  applyRemote(table: SyncTable, rows: SyncRow[]): Promise<void>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

export interface RemoteApi {
  /** Idempotenter Upsert per id. Wirft SyncError. */
  upsert(table: SyncTable, rows: Record<string, unknown>[]): Promise<void>;
  /** Zeilen mit updated_at >= since, aufsteigend sortiert (since null = alles). */
  fetchSince(table: SyncTable, since: string | null, limit: number): Promise<SyncRow[]>;
}

/** retryable = Netzwerk/Server-Problem (später erneut versuchen); sonst Zeile wird abgelehnt. */
export class SyncError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}
