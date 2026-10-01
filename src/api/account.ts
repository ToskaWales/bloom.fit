import { supabase } from './supabase';

/** DSGVO Art. 20: alle eigenen Daten als JSON (SQL-Funktion export_my_data, nur eigene Zeilen). */
export async function exportMyData() {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  return data;
}

/** Löscht Account und alle Daten (Edge Function delete-account, Cascade in der DB) und meldet ab. */
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await supabase.auth.signOut();
}
