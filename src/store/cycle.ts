import { create } from 'zustand';
import { deleteCycle, listCycles, saveCycle } from '@/api/cycles';
import type { CycleRow } from '@/api/database.types';

type CycleState = {
  cycles: CycleRow[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (
    userId: string,
    input: { id?: string; periodStart: string; periodEnd: string | null },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
};

export const useCycleStore = create<CycleState>((set, get) => ({
  cycles: [],
  loaded: false,
  load: async () => set({ cycles: await listCycles(), loaded: true }),
  save: async (userId, input) => {
    await saveCycle(userId, input);
    await get().load();
  },
  remove: async (id) => {
    await deleteCycle(id);
    await get().load();
  },
  reset: () => set({ cycles: [], loaded: false }),
}));
