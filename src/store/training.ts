import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import * as Network from 'expo-network';
import { create } from 'zustand';
import {
  isCompleteSet,
  type Exercise,
  type SetEntry,
  type WorkoutEntry,
  type WorkoutSummary,
} from '@/lib/training';
import { countPending, syncAll } from '@/sync/syncEngine';
import { openLocalDb, SqliteStore } from '@/sync/sqliteStore';
import { supabaseRemote } from '@/sync/supabaseRemote';
import { TrainingRepo } from '@/sync/trainingRepo';

type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

type TrainingState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  exercises: Exercise[];
  active: WorkoutEntry | null;
  recent: WorkoutSummary[];
  /** letzte Leistung je Übung (für Vorschläge), wird beim Hinzufügen geladen */
  lastPerformance: Record<string, SetEntry[]>;
  sync: { state: SyncState; pending: number };

  init: (userId: string) => Promise<void>;
  dispose: () => void;
  startWorkout: () => Promise<void>;
  addExercise: (exerciseId: string) => Promise<void>;
  removeExercise: (workoutExerciseId: string) => Promise<void>;
  addSet: (workoutExerciseId: string, copyFrom?: SetEntry) => Promise<void>;
  updateSet: (
    setId: string,
    patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'rpe' | 'isWarmup'>>,
  ) => void;
  removeSet: (setId: string) => Promise<void>;
  finishWorkout: () => Promise<'saved' | 'discarded'>;
  discardWorkout: () => Promise<void>;
  createExercise: (name: string) => Promise<Exercise>;
  syncNow: () => Promise<void>;
};

// Laufzeit-Objekte (nicht im Zustand, da nicht serialisierbar / nicht für die UI relevant)
let repo: TrainingRepo | null = null;
let store: SqliteStore | null = null;
let subscriptions: { remove: () => void }[] = [];
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let syncAgain = false;
// Schreibzugriffe nacheinander ausführen, damit schnelle Eingaben in der richtigen Reihenfolge landen
let writeQueue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => {});
  return next;
};

const SYNC_DEBOUNCE_MS = 4000;

export const useTrainingStore = create<TrainingState>((set, get) => {
  const requireRepo = () => {
    if (!repo) throw new Error('Training-Speicher nicht initialisiert');
    return repo;
  };

  const reloadActive = async () => {
    const active = await requireRepo().getActiveWorkout();
    set({ active });
  };
  const reloadRecent = async () => set({ recent: await requireRepo().recentWorkouts() });
  const reloadExercises = async () => set({ exercises: await requireRepo().listExercises() });

  const scheduleSync = () => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => void get().syncNow(), SYNC_DEBOUNCE_MS);
  };

  return {
    status: 'idle',
    exercises: [],
    active: null,
    recent: [],
    lastPerformance: {},
    sync: { state: 'idle', pending: 0 },

    init: async (userId) => {
      get().dispose();
      set({ status: 'loading' });
      try {
        const db = await openLocalDb(userId);
        store = new SqliteStore(db);
        repo = new TrainingRepo(store, userId);
        await Promise.all([reloadActive(), reloadRecent(), reloadExercises()]);
        set({ status: 'ready', sync: { state: 'idle', pending: await countPending(store) } });
      } catch {
        set({ status: 'error' });
        return;
      }

      const onAppState = (next: AppStateStatus) => {
        if (next === 'active') void get().syncNow();
      };
      const appSub: NativeEventSubscription = AppState.addEventListener('change', onAppState);
      const netSub = Network.addNetworkStateListener((state) => {
        if (state.isConnected && state.isInternetReachable !== false) void get().syncNow();
      });
      subscriptions = [appSub, netSub];
      void get().syncNow();
    },

    dispose: () => {
      subscriptions.forEach((s) => s.remove());
      subscriptions = [];
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = null;
      repo = null;
      store = null;
      set({ status: 'idle', exercises: [], active: null, recent: [], lastPerformance: {} });
    },

    startWorkout: () =>
      enqueue(async () => {
        await requireRepo().startWorkout();
        await reloadActive();
        scheduleSync();
      }),

    addExercise: (exerciseId) =>
      enqueue(async () => {
        const active = get().active;
        if (!active) return;
        const r = requireRepo();
        const last = await r.lastPerformance(exerciseId);
        set({ lastPerformance: { ...get().lastPerformance, [exerciseId]: last } });
        await r.addExercise(active.id, exerciseId);
        await reloadActive();
        scheduleSync();
      }),

    removeExercise: (workoutExerciseId) =>
      enqueue(async () => {
        await requireRepo().removeExercise(workoutExerciseId);
        await reloadActive();
        scheduleSync();
      }),

    addSet: (workoutExerciseId, copyFrom) =>
      enqueue(async () => {
        await requireRepo().addSet(
          workoutExerciseId,
          copyFrom
            ? { weightKg: copyFrom.weightKg, reps: copyFrom.reps, isWarmup: copyFrom.isWarmup }
            : {},
        );
        await reloadActive();
        scheduleSync();
      }),

    updateSet: (setId, patch) => {
      // sofort in der Oberfläche sichtbar, Speichern folgt in der Warteschlange
      const active = get().active;
      if (active) {
        set({
          active: {
            ...active,
            exercises: active.exercises.map((we) => ({
              ...we,
              sets: we.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
            })),
          },
        });
      }
      void enqueue(async () => {
        await requireRepo().updateSet(setId, patch);
        scheduleSync();
      });
    },

    removeSet: (setId) =>
      enqueue(async () => {
        await requireRepo().removeSet(setId);
        await reloadActive();
        scheduleSync();
      }),

    finishWorkout: () =>
      enqueue(async () => {
        const active = get().active;
        if (!active) return 'discarded';
        const outcome = await requireRepo().finishWorkout(active.id);
        await Promise.all([reloadActive(), reloadRecent()]);
        void get().syncNow();
        return outcome;
      }),

    discardWorkout: () =>
      enqueue(async () => {
        const active = get().active;
        if (!active) return;
        await requireRepo().discardWorkout(active.id);
        await Promise.all([reloadActive(), reloadRecent()]);
        scheduleSync();
      }),

    createExercise: (name) =>
      enqueue(async () => {
        const exercise = await requireRepo().createExercise(name);
        await reloadExercises();
        scheduleSync();
        return exercise;
      }),

    syncNow: async () => {
      if (!store) return;
      if (syncing) {
        syncAgain = true;
        return;
      }
      syncing = true;
      set({ sync: { ...get().sync, state: 'syncing' } });
      try {
        await syncAll(store, supabaseRemote);
        // Katalog/Historie können sich durch den Pull geändert haben
        await Promise.all([reloadExercises(), reloadRecent()]);
        set({ sync: { state: 'idle', pending: await countPending(store) } });
      } catch {
        const pending = store ? await countPending(store).catch(() => 0) : 0;
        const reachable = await Network.getNetworkStateAsync().catch(() => null);
        set({ sync: { state: reachable?.isConnected === false ? 'offline' : 'error', pending } });
      } finally {
        syncing = false;
        if (syncAgain) {
          syncAgain = false;
          void get().syncNow();
        }
      }
    },
  };
});

/** Anzahl vollständiger Sätze im laufenden Training (für die Anzeige). */
export const completeSetCount = (workout: WorkoutEntry | null) =>
  workout ? workout.exercises.reduce((n, we) => n + we.sets.filter(isCompleteSet).length, 0) : 0;
