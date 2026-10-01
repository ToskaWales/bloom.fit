import { create } from 'zustand';
import {
  deleteEntry,
  listEntries,
  recentEntries,
  saveEntry,
  type SaveEntryInput,
} from '@/api/nutrition';
import type { NutritionEntryRow } from '@/api/database.types';
import { todayIso } from '@/lib/date';
import type { Macros } from '@/lib/nutrition';

/** Vorbelegung für das Formular: Bearbeiten, „Zuletzt gegessen" oder Barcode-Treffer. */
export type FoodSeed = {
  id?: string;
  name: string;
  barcode: string | null;
  quantityG: number;
  /** Werte pro 100 g; null = unbekannt (z. B. Produkt ohne Nährwerte) */
  per100: Macros | null;
  /** Hinweis für das Formular, z. B. „Nährwerte fehlen" */
  note?: 'notFound' | 'noNutrition';
};

type NutritionState = {
  date: string;
  entries: NutritionEntryRow[];
  recent: NutritionEntryRow[];
  loaded: boolean;
  seed: FoodSeed | null;
  setDate: (date: string) => Promise<void>;
  load: () => Promise<void>;
  setSeed: (seed: FoodSeed | null) => void;
  save: (userId: string, input: Omit<SaveEntryInput, 'date'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
};

export const useNutritionStore = create<NutritionState>((set, get) => ({
  date: todayIso(),
  entries: [],
  recent: [],
  loaded: false,
  seed: null,
  load: async () => {
    const date = get().date;
    const [entries, recent] = await Promise.all([listEntries(date), recentEntries()]);
    // Nur übernehmen, wenn der Tag zwischenzeitlich nicht gewechselt wurde
    if (get().date === date) set({ entries, recent, loaded: true });
  },
  setDate: async (date) => {
    set({ date });
    await get().load();
  },
  setSeed: (seed) => set({ seed }),
  save: async (userId, input) => {
    await saveEntry(userId, { ...input, date: get().date });
    await get().load();
  },
  remove: async (id) => {
    await deleteEntry(id);
    await get().load();
  },
  reset: () => set({ date: todayIso(), entries: [], recent: [], loaded: false, seed: null }),
}));
