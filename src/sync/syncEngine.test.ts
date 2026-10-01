import { MemoryStore } from './memoryStore';
import { countPending, syncAll } from './syncEngine';
import { normalizeForPush } from './tables';
import { SyncError, type RemoteApi, type SyncRow, type SyncTable } from './types';

/** Fake-Server: speichert per id (Upsert) und vergibt aufsteigende updated_at. */
class FakeRemote implements RemoteApi {
  data: Record<SyncTable, Map<string, SyncRow>> = {
    exercises: new Map(),
    workouts: new Map(),
    workout_exercises: new Map(),
    sets: new Map(),
  };
  upsertCalls: SyncTable[] = [];
  failWith: SyncError | Error | null = null;
  failTable: SyncTable | null = null;
  beforeUpsert: (() => Promise<void>) | null = null;
  private tick = 0;

  async upsert(table: SyncTable, rows: Record<string, unknown>[]) {
    this.upsertCalls.push(table);
    if (this.beforeUpsert) await this.beforeUpsert();
    if (this.failWith && (!this.failTable || this.failTable === table)) throw this.failWith;
    this.tick += 1;
    const updated_at = `2026-10-01T10:00:${String(this.tick).padStart(2, '0')}Z`;
    for (const row of rows)
      this.data[table].set(row.id as string, { ...(row as SyncRow), updated_at });
  }

  async fetchSince(table: SyncTable, since: string | null, limit: number) {
    return [...this.data[table].values()]
      .filter((r) => since === null || (r.updated_at as string) >= since)
      .sort((a, b) => (a.updated_at as string).localeCompare(b.updated_at as string))
      .slice(0, limit);
  }

  seed(table: SyncTable, row: SyncRow) {
    this.data[table].set(row.id, row);
  }
}

const workout = { id: 'w1', user_id: 'u1', performed_on: '2026-10-01', deleted_at: null };
const we = {
  id: 'we1',
  user_id: 'u1',
  workout_id: 'w1',
  exercise_id: 'ex1',
  position: 0,
  deleted_at: null,
};
const set = (id: string, extra: Record<string, unknown> = {}): SyncRow => ({
  id,
  user_id: 'u1',
  workout_exercise_id: 'we1',
  set_index: 0,
  weight_kg: 80,
  reps: 5,
  rpe: null,
  is_warmup: false,
  deleted_at: null,
  ...extra,
});

describe('syncAll – Push', () => {
  it('sendet Eltern vor Kindern', async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    // absichtlich in „falscher" Reihenfolge geschrieben
    await store.writeLocal('sets', set('s1'));
    await store.writeLocal('workout_exercises', we);
    await store.writeLocal('workouts', workout);
    await syncAll(store, remote);
    expect(remote.upsertCalls).toEqual(['workouts', 'workout_exercises', 'sets']);
    expect(await countPending(store)).toBe(0);
  });

  it('ist idempotent: zweiter Lauf sendet nichts mehr, ids bleiben eindeutig', async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    await store.writeLocal('workouts', workout);
    await syncAll(store, remote);
    const second = await syncAll(store, remote);
    expect(second.pushed).toBe(0);
    expect(remote.data.workouts.size).toBe(1);
  });

  it('hält unvollständige Sätze zurück, bis sie komplett sind', async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    await store.writeLocal('workouts', workout);
    await store.writeLocal('workout_exercises', we);
    await store.writeLocal('sets', set('s1', { reps: null }));
    await syncAll(store, remote);
    expect(remote.data.sets.size).toBe(0);
    expect(await countPending(store)).toBe(0); // zählt nur Sendbares

    await store.writeLocal('sets', set('s1', { reps: 8 }));
    await syncAll(store, remote);
    expect(remote.data.sets.get('s1')?.reps).toBe(8);
  });

  it('sendet gelöschte unvollständige Sätze als gültigen Tombstone', async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    await store.writeLocal('workouts', workout);
    await store.writeLocal('workout_exercises', we);
    await store.writeLocal(
      'sets',
      set('s1', { weight_kg: null, reps: null, deleted_at: '2026-10-01T10:00:00Z' }),
    );
    await syncAll(store, remote);
    const sent = remote.data.sets.get('s1')!;
    expect(sent.reps).toBe(1);
    expect(sent.weight_kg).toBe(0);
    expect(sent.deleted_at).toBe('2026-10-01T10:00:00Z');
  });

  it('lässt Zeilen dirty, die während des Pushs erneut geändert wurden', async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    await store.writeLocal('workouts', workout);
    remote.beforeUpsert = async () => {
      await store.writeLocal('workouts', { ...workout, notes: 'später geändert' });
    };
    await syncAll(store, remote);
    expect(store.get('workouts', 'w1')?.dirty).toBe(true);
    remote.beforeUpsert = null;
    await syncAll(store, remote);
    expect(store.get('workouts', 'w1')?.dirty).toBe(false);
    expect(remote.data.workouts.get('w1')?.notes).toBe('später geändert');
  });

  it('bricht bei retrybaren Fehlern ab und behält alles dirty', async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    await store.writeLocal('workouts', workout);
    remote.failWith = new SyncError('offline', true);
    await expect(syncAll(store, remote)).rejects.toThrow('offline');
    expect(await countPending(store)).toBe(1);

    remote.failWith = null;
    await syncAll(store, remote);
    expect(await countPending(store)).toBe(0);
  });

  it('legt abgelehnte Zeilen in Quarantäne und synchronisiert den Rest', async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    await store.writeLocal('workouts', workout);
    await store.writeLocal('workout_exercises', we);
    remote.failWith = new SyncError('check constraint', false);
    remote.failTable = 'workout_exercises';
    const result = await syncAll(store, remote);
    expect(result.quarantined).toBe(1);
    expect(remote.data.workouts.size).toBe(1);
    expect(store.get('workout_exercises', 'we1')?.failed).toBe(true);

    remote.upsertCalls = [];
    remote.failWith = null;
    await syncAll(store, remote);
    expect(remote.upsertCalls).not.toContain('workout_exercises'); // wird nicht erneut versucht
  });
});

describe('syncAll – Pull', () => {
  it('übernimmt Serverdaten, ungesendete lokale Änderungen werden nicht überschrieben', async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    remote.seed('workouts', { ...workout, id: 'w-remote', updated_at: '2026-10-01T09:00:00Z' });
    await store.writeLocal('workouts', { ...workout, id: 'w-both', notes: 'lokal' });

    // Serverstand trifft ein, während die lokale Änderung noch nicht gepusht ist
    await store.applyRemote('workouts', [
      { ...workout, id: 'w-both', notes: 'server', updated_at: '2026-10-01T09:00:01Z' },
    ]);
    expect(store.get('workouts', 'w-both')?.row.notes).toBe('lokal');

    await syncAll(store, remote);
    expect(store.get('workouts', 'w-remote')).toBeDefined();
    expect(remote.data.workouts.get('w-both')?.notes).toBe('lokal');
  });

  it('wendet Tombstones vom Server an', async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    remote.seed('sets', {
      ...set('s9'),
      deleted_at: '2026-10-01T08:00:00Z',
      updated_at: '2026-10-01T08:00:00Z',
    });
    await syncAll(store, remote);
    expect(store.get('sets', 's9')?.row.deleted_at).toBe('2026-10-01T08:00:00Z');
  });

  it('merkt sich den Cursor und holt danach nur Neues', async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    remote.seed('exercises', {
      id: 'e1',
      user_id: null,
      name: 'Kniebeuge',
      aliases: [],
      updated_at: '2026-10-01T08:00:00Z',
    });
    const first = await syncAll(store, remote);
    expect(first.pulled).toBeGreaterThan(0);
    expect(store.meta.get('pull:exercises')).toBe('2026-10-01T08:00:00Z');

    remote.seed('exercises', {
      id: 'e2',
      user_id: null,
      name: 'Kreuzheben',
      aliases: [],
      updated_at: '2026-10-01T09:00:00Z',
    });
    await syncAll(store, remote);
    expect(store.get('exercises', 'e2')).toBeDefined();
    expect(store.meta.get('pull:exercises')).toBe('2026-10-01T09:00:00Z');
  });
});

describe('normalizeForPush', () => {
  it('entfernt Audit-Spalten und ergänzt Aliase', () => {
    const payload = normalizeForPush('exercises', {
      id: 'e1',
      user_id: 'u1',
      name: 'Meine Übung',
      aliases: null,
      created_at: 'x',
      updated_at: 'y',
    });
    expect(payload).toEqual({ id: 'e1', user_id: 'u1', name: 'Meine Übung', aliases: [] });
  });
});
