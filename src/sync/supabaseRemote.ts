import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/api/supabase';
import { SyncError, type RemoteApi, type SyncRow, type SyncTable } from './types';

// Der generische Zugriff über Tabellennamen braucht den untypisierten Client.
const client = supabase as unknown as SupabaseClient;

/** Postgres-Klassen 22 (Datenfehler), 23 (Constraint), 42 (u. a. RLS 42501) werden nicht wiederholt. */
const PERMANENT = /^(22|23|42)/;

export const supabaseRemote: RemoteApi = {
  async upsert(table: SyncTable, rows) {
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw new SyncError(error.message, !PERMANENT.test(error.code ?? ''));
  },

  async fetchSince(table: SyncTable, since: string | null, limit: number) {
    let query = client.from(table).select('*');
    if (since) query = query.gte('updated_at', since);
    const { data, error } = await query.order('updated_at', { ascending: true }).limit(limit);
    if (error) throw new SyncError(error.message, true);
    return (data ?? []) as SyncRow[];
  },
};
