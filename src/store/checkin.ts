import { create } from 'zustand';
import { fetchCheckin, saveCheckin } from '@/api/checkins';
import type { DailyCheckinRow } from '@/api/database.types';
import { todayIso } from '@/lib/date';

type CheckinState = {
  /** heutiges Check-in, null = noch keins */
  today: DailyCheckinRow | null;
  loaded: boolean;
  load: () => Promise<void>;
  save: (
    userId: string,
    input: { sleepHours: number; motivation: number; energy: number },
  ) => Promise<void>;
  reset: () => void;
};

export const useCheckinStore = create<CheckinState>((set, get) => ({
  today: null,
  loaded: false,
  load: async () => set({ today: await fetchCheckin(todayIso()), loaded: true }),
  save: async (userId, input) => {
    const saved = await saveCheckin(userId, { ...input, date: todayIso() }, get().today?.id);
    set({ today: saved, loaded: true });
  },
  reset: () => set({ today: null, loaded: false }),
}));
