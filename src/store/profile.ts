import { create } from 'zustand';
import { completeOnboarding, fetchProfile } from '@/api/profile';
import type { ProfileRow } from '@/api/database.types';
import type { OnboardingInput } from '@/lib/onboarding';

type ProfileState = {
  profile: ProfileRow | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  load: (userId: string) => Promise<void>;
  finishOnboarding: (userId: string, input: OnboardingInput) => Promise<void>;
  reset: () => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  status: 'idle',
  load: async (userId) => {
    set({ status: 'loading' });
    try {
      set({ profile: await fetchProfile(userId), status: 'ready' });
    } catch {
      set({ status: 'error' });
    }
  },
  finishOnboarding: async (userId, input) => {
    set({ profile: await completeOnboarding(userId, input) });
  },
  reset: () => set({ profile: null, status: 'idle' }),
}));
