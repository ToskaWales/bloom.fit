import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '@/api/supabase';

type SessionState = {
  session: Session | null;
  /** false, bis die gespeicherte Session geladen wurde */
  ready: boolean;
  init: () => () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  ready: false,
  init: () => {
    if (!isSupabaseConfigured) {
      set({ ready: true });
      return () => {};
    }
    supabase.auth.getSession().then(({ data }) => set({ session: data.session, ready: true }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => set({ session }));
    return () => data.subscription.unsubscribe();
  },
}));
