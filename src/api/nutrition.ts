import { randomUUID } from 'expo-crypto';
import type { NutritionEntryRow } from './database.types';
import { supabase } from './supabase';
import type { Macros } from '@/lib/nutrition';

export async function listEntries(date: string): Promise<NutritionEntryRow[]> {
  const { data, error } = await supabase
    .from('nutrition_entries')
    .select('*')
    .eq('logged_on', date)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Die zuletzt geloggten Einträge (neueste zuerst) – Grundlage für „Zuletzt gegessen". */
export async function recentEntries(): Promise<NutritionEntryRow[]> {
  const { data, error } = await supabase
    .from('nutrition_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export type SaveEntryInput = {
  id?: string;
  date: string;
  name: string;
  barcode: string | null;
  quantityG: number;
  /** Gesamtwerte für die Menge (nicht pro 100 g) */
  totals: Macros;
};

export async function saveEntry(userId: string, input: SaveEntryInput): Promise<void> {
  const values = {
    logged_on: input.date,
    name: input.name,
    barcode: input.barcode,
    quantity_g: input.quantityG,
    kcal: input.totals.kcal,
    protein_g: input.totals.proteinG,
    carbs_g: input.totals.carbsG,
    fat_g: input.totals.fatG,
  };
  const { error } = input.id
    ? await supabase.from('nutrition_entries').update(values).eq('id', input.id)
    : await supabase
        .from('nutrition_entries')
        .insert({ id: randomUUID(), user_id: userId, ...values });
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('nutrition_entries').delete().eq('id', id);
  if (error) throw error;
}
