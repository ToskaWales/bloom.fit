import { randomUUID } from 'expo-crypto';
import type { CycleRow } from './database.types';
import { supabase } from './supabase';

export class CycleSaveError extends Error {
  constructor(public reason: 'overlap' | 'unknown') {
    super(reason);
  }
}

// Postgres: 23P01 = Exclusion-Constraint (Überlappung), 23505 = Unique (gleicher Beginn)
const OVERLAP_CODES = new Set(['23P01', '23505']);

export async function listCycles(): Promise<CycleRow[]> {
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .order('period_start', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveCycle(
  userId: string,
  input: { id?: string; periodStart: string; periodEnd: string | null },
): Promise<void> {
  const row = {
    id: input.id ?? randomUUID(),
    user_id: userId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    source: 'manual' as const,
  };
  const { error } = input.id
    ? await supabase
        .from('cycles')
        .update({ period_start: row.period_start, period_end: row.period_end })
        .eq('id', input.id)
    : await supabase.from('cycles').insert(row);
  if (error) throw new CycleSaveError(OVERLAP_CODES.has(error.code) ? 'overlap' : 'unknown');
}

export async function deleteCycle(id: string): Promise<void> {
  const { error } = await supabase.from('cycles').delete().eq('id', id);
  if (error) throw error;
}
