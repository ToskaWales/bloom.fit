import { randomUUID } from 'expo-crypto';
import type { DailyCheckinRow } from './database.types';
import { supabase } from './supabase';

export async function fetchCheckin(date: string): Promise<DailyCheckinRow | null> {
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('checkin_on', date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Ein Eintrag pro Nutzerin und Tag: erneutes Speichern überschreibt. Die vorhandene id wird
 * wiederverwendet, damit der Primärschlüssel beim Überschreiben stabil bleibt.
 */
export async function saveCheckin(
  userId: string,
  input: { date: string; sleepHours: number; motivation: number; energy: number },
  existingId?: string,
): Promise<DailyCheckinRow> {
  const { data, error } = await supabase
    .from('daily_checkins')
    .upsert(
      {
        id: existingId ?? randomUUID(),
        user_id: userId,
        checkin_on: input.date,
        sleep_hours: input.sleepHours,
        motivation: input.motivation,
        energy: input.energy,
      },
      { onConflict: 'user_id,checkin_on' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
