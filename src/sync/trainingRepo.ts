import { randomUUID } from 'expo-crypto';
import type * as SQLite from 'expo-sqlite';
import { todayIso } from '@/lib/date';
import {
  isCompleteSet,
  type Exercise,
  type SetEntry,
  type WorkoutEntry,
  type WorkoutSummary,
} from '@/lib/training';
import { fromDb, SqliteStore } from './sqliteStore';
import type { SyncRow } from './types';

const nowIso = () => new Date().toISOString();

type Raw = Record<string, unknown>;

function toSet(raw: Raw): SetEntry {
  return {
    id: raw.id as string,
    workoutExerciseId: raw.workout_exercise_id as string,
    setIndex: raw.set_index as number,
    weightKg: (raw.weight_kg as number | null) ?? null,
    reps: (raw.reps as number | null) ?? null,
    rpe: (raw.rpe as number | null) ?? null,
    isWarmup: !!raw.is_warmup,
  };
}

/** Domänen-Zugriffe auf die lokale Datenbank. Alle Schreibzugriffe laufen über SqliteStore.writeLocal. */
export class TrainingRepo {
  private db: SQLite.SQLiteDatabase;

  constructor(
    private store: SqliteStore,
    private userId: string,
  ) {
    this.db = store.db;
  }

  async listExercises(): Promise<Exercise[]> {
    const rows = await this.db.getAllAsync<Raw>(
      'select * from exercises order by name collate nocase',
    );
    return rows.map((raw) => {
      const row = fromDb('exercises', raw);
      return {
        id: row.id,
        userId: (row.user_id as string | null) ?? null,
        name: row.name as string,
        aliases: (row.aliases as string[]) ?? [],
      };
    });
  }

  async createExercise(name: string): Promise<Exercise> {
    const trimmed = name.trim();
    const existing = (await this.listExercises()).find(
      (e) => e.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    const id = randomUUID();
    await this.store.writeLocal('exercises', {
      id,
      user_id: this.userId,
      name: trimmed,
      aliases: [],
    });
    return { id, userId: this.userId, name: trimmed, aliases: [] };
  }

  async getActiveWorkout(): Promise<WorkoutEntry | null> {
    const raw = await this.db.getFirstAsync<Raw>(
      `select id from workouts where ended_at is null and deleted_at is null order by started_at desc limit 1`,
    );
    return raw ? this.loadWorkout(raw.id as string) : null;
  }

  async loadWorkout(workoutId: string): Promise<WorkoutEntry | null> {
    const w = await this.db.getFirstAsync<Raw>(
      'select * from workouts where id = ? and deleted_at is null',
      [workoutId],
    );
    if (!w) return null;
    const exercises = await this.db.getAllAsync<Raw>(
      `select we.id, we.exercise_id, we.position, e.name as exercise_name
       from workout_exercises we join exercises e on e.id = we.exercise_id
       where we.workout_id = ? and we.deleted_at is null order by we.position`,
      [workoutId],
    );
    const sets = await this.db.getAllAsync<Raw>(
      `select s.* from sets s join workout_exercises we on we.id = s.workout_exercise_id
       where we.workout_id = ? and s.deleted_at is null and we.deleted_at is null order by s.set_index`,
      [workoutId],
    );
    return {
      id: w.id as string,
      performedOn: w.performed_on as string,
      startedAt: (w.started_at as string | null) ?? null,
      endedAt: (w.ended_at as string | null) ?? null,
      exercises: exercises.map((we) => ({
        id: we.id as string,
        exerciseId: we.exercise_id as string,
        exerciseName: we.exercise_name as string,
        position: we.position as number,
        sets: sets.filter((s) => s.workout_exercise_id === we.id).map(toSet),
      })),
    };
  }

  async recentWorkouts(limit = 10): Promise<WorkoutSummary[]> {
    const rows = await this.db.getAllAsync<Raw>(
      `select w.id, w.performed_on,
         (select count(*) from workout_exercises we where we.workout_id = w.id and we.deleted_at is null) as exercise_count,
         (select count(*) from sets s join workout_exercises we on we.id = s.workout_exercise_id
            where we.workout_id = w.id and s.deleted_at is null and we.deleted_at is null) as set_count
       from workouts w where w.deleted_at is null and w.ended_at is not null
       order by w.performed_on desc, w.started_at desc limit ?`,
      [limit],
    );
    return rows.map((r) => ({
      id: r.id as string,
      performedOn: r.performed_on as string,
      exerciseCount: r.exercise_count as number,
      setCount: r.set_count as number,
    }));
  }

  /** Sätze der Übung aus dem zuletzt beendeten Training (für Vorschläge). */
  async lastPerformance(exerciseId: string): Promise<SetEntry[]> {
    const rows = await this.db.getAllAsync<Raw>(
      `select s.*, w.id as workout_id
       from sets s
       join workout_exercises we on we.id = s.workout_exercise_id
       join workouts w on w.id = we.workout_id
       where we.exercise_id = ? and s.deleted_at is null and we.deleted_at is null and w.deleted_at is null
         and w.ended_at is not null and s.weight_kg is not null and s.reps is not null
       order by w.performed_on desc, w.started_at desc, s.set_index asc`,
      [exerciseId],
    );
    if (rows.length === 0) return [];
    const firstWorkout = rows[0].workout_id;
    return rows.filter((r) => r.workout_id === firstWorkout).map(toSet);
  }

  async startWorkout(): Promise<string> {
    const id = randomUUID();
    await this.store.writeLocal('workouts', {
      id,
      user_id: this.userId,
      performed_on: todayIso(),
      started_at: nowIso(),
      ended_at: null,
      notes: null,
      deleted_at: null,
    });
    return id;
  }

  async addExercise(workoutId: string, exerciseId: string): Promise<void> {
    const max = await this.db.getFirstAsync<{ m: number | null }>(
      'select max(position) as m from workout_exercises where workout_id = ? and deleted_at is null',
      [workoutId],
    );
    await this.store.writeLocal('workout_exercises', {
      id: randomUUID(),
      user_id: this.userId,
      workout_id: workoutId,
      exercise_id: exerciseId,
      position: (max?.m ?? -1) + 1,
      deleted_at: null,
    });
  }

  async removeExercise(workoutExerciseId: string): Promise<void> {
    const now = nowIso();
    const sets = await this.db.getAllAsync<Raw>(
      'select * from sets where workout_exercise_id = ? and deleted_at is null',
      [workoutExerciseId],
    );
    for (const raw of sets)
      await this.store.writeLocal('sets', { ...fromDb('sets', raw), deleted_at: now });
    await this.softDelete('workout_exercises', workoutExerciseId, now);
  }

  async addSet(
    workoutExerciseId: string,
    init: { weightKg?: number | null; reps?: number | null; isWarmup?: boolean } = {},
  ): Promise<void> {
    const max = await this.db.getFirstAsync<{ m: number | null }>(
      'select max(set_index) as m from sets where workout_exercise_id = ? and deleted_at is null',
      [workoutExerciseId],
    );
    await this.store.writeLocal('sets', {
      id: randomUUID(),
      user_id: this.userId,
      workout_exercise_id: workoutExerciseId,
      set_index: (max?.m ?? -1) + 1,
      weight_kg: init.weightKg ?? null,
      reps: init.reps ?? null,
      rpe: null,
      is_warmup: init.isWarmup ?? false,
      deleted_at: null,
    });
  }

  async updateSet(
    setId: string,
    patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'rpe' | 'isWarmup'>>,
  ): Promise<void> {
    const raw = await this.db.getFirstAsync<Raw>('select * from sets where id = ?', [setId]);
    if (!raw) return;
    const row = fromDb('sets', raw);
    if ('weightKg' in patch) row.weight_kg = patch.weightKg ?? null;
    if ('reps' in patch) row.reps = patch.reps ?? null;
    if ('rpe' in patch) row.rpe = patch.rpe ?? null;
    if ('isWarmup' in patch) row.is_warmup = !!patch.isWarmup;
    await this.store.writeLocal('sets', row);
  }

  async removeSet(setId: string): Promise<void> {
    await this.softDelete('sets', setId, nowIso());
  }

  /**
   * Beendet das Training. Unvollständige Sätze werden verworfen; bleibt kein vollständiger Satz übrig,
   * wird das ganze Training verworfen. Rückgabe: 'saved' oder 'discarded'.
   */
  async finishWorkout(workoutId: string): Promise<'saved' | 'discarded'> {
    const workout = await this.loadWorkout(workoutId);
    if (!workout) return 'discarded';
    const now = nowIso();
    let complete = 0;
    for (const we of workout.exercises) {
      for (const set of we.sets) {
        if (isCompleteSet(set)) complete += 1;
        else await this.softDelete('sets', set.id, now);
      }
    }
    if (complete === 0) {
      await this.discardWorkout(workoutId);
      return 'discarded';
    }
    const raw = await this.db.getFirstAsync<Raw>('select * from workouts where id = ?', [
      workoutId,
    ]);
    if (raw) await this.store.writeLocal('workouts', { ...fromDb('workouts', raw), ended_at: now });
    return 'saved';
  }

  async discardWorkout(workoutId: string): Promise<void> {
    const now = nowIso();
    const exercises = await this.db.getAllAsync<Raw>(
      'select id from workout_exercises where workout_id = ? and deleted_at is null',
      [workoutId],
    );
    for (const we of exercises) await this.removeExercise(we.id as string);
    await this.softDelete('workouts', workoutId, now);
  }

  private async softDelete(
    table: 'workouts' | 'workout_exercises' | 'sets',
    id: string,
    now: string,
  ) {
    const raw = await this.db.getFirstAsync<Raw>(`select * from ${table} where id = ?`, [id]);
    if (!raw) return;
    const row: SyncRow = { ...fromDb(table, raw), deleted_at: now };
    await this.store.writeLocal(table, row);
  }
}
