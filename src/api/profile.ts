import { randomUUID } from 'expo-crypto';
import type { ConsentType, ProfileRow } from './database.types';
import { supabase } from './supabase';
import type { OnboardingInput } from '@/lib/onboarding';

/** Version der (vorläufigen) Einwilligungstexte; rechtlich geprüfte Texte folgen in Phase 6. */
export const CONSENT_VERSION = 'draft-1';

export async function fetchProfile(userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

/**
 * Schließt das Onboarding ab. Reihenfolge: Einwilligungen → erste Periode → Profil (`onboarded_at` zuletzt),
 * damit ein Abbruch mittendrin das Onboarding nicht fälschlich als abgeschlossen markiert.
 * Jeder Schritt ist wiederholbar (kein doppelter Consent, Periode per Upsert).
 */
export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
): Promise<ProfileRow> {
  const { data: existing, error: consentReadError } = await supabase
    .from('user_consents')
    .select('consent_type')
    .eq('version', CONSENT_VERSION)
    .is('revoked_at', null);
  if (consentReadError) throw consentReadError;

  const have = new Set((existing ?? []).map((c) => c.consent_type));
  const needed: ConsentType[] = ['health_data', 'privacy_policy'];
  const missing = needed.filter((type) => !have.has(type));
  if (missing.length > 0) {
    const { error } = await supabase.from('user_consents').insert(
      missing.map((consent_type) => ({
        user_id: userId,
        consent_type,
        version: CONSENT_VERSION,
      })),
    );
    if (error) throw error;
  }

  if (input.lastPeriodStart) {
    const { error } = await supabase.from('cycles').upsert(
      {
        id: randomUUID(),
        user_id: userId,
        period_start: input.lastPeriodStart,
        source: 'manual',
      },
      { onConflict: 'user_id,period_start', ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      training_goal: input.trainingGoal,
      training_experience: input.trainingExperience,
      cycle_context: input.cycleContext ?? 'regular',
      default_cycle_length: Number(input.cycleLength),
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
