// Local reads/writes for the daily log: check-in, body weight and cycle events.
// There is exactly ONE row per (user, kind, day): its id is derived with dailyId()
// from src/lib/ids.ts, so two offline devices that log the same day update the same
// row instead of duplicating it. Writes go through repo.ts; engine logic is elsewhere.
import { dailyId } from "@/lib/ids";
import type { Symptom } from "@/lib/daily/symptoms";
import type { LocalDb } from "./db";
import { saveRow } from "./repo";
import type { CheckinRow, CycleEventRow, WeightRow } from "./types";

// The row id is derived from user + day, so it is computed before any database
// transaction starts (awaiting crypto inside a Dexie transaction would end it).

// Form-friendly (camelCase) view of a check-in; scales are 1-5, null = not answered.
export interface CheckinValues {
  sleepQuality: number | null;
  sleepHours: number | null;
  energy: number | null;
  motivation: number | null;
  hunger: number | null;
  symptoms: Symptom[];
  note: string | null;
}

// The day's check-in, or undefined when none exists or it was deleted.
export async function getCheckin(
  db: LocalDb,
  userId: string,
  day: string,
): Promise<CheckinRow | undefined> {
  const row = (await db.checkins.get(await dailyId(userId, "checkin", day))) as
    CheckinRow | undefined;
  return row && !row.deleted_at ? row : undefined;
}

const EMPTY: CheckinValues = {
  sleepQuality: null,
  sleepHours: null,
  energy: null,
  motivation: null,
  hunger: null,
  symptoms: [],
  note: null,
};

const toValues = (r: CheckinRow): CheckinValues => ({
  sleepQuality: r.sleep_quality,
  sleepHours: r.sleep_hours,
  energy: r.energy,
  motivation: r.motivation,
  hunger: r.hunger,
  symptoms: r.symptoms as Symptom[],
  note: r.note,
});

type CheckinPatch =
  Partial<CheckinValues> | ((current: CheckinValues) => Partial<CheckinValues>);

// Read-modify-write inside one transaction: quick consecutive taps, or a note
// blurring while a button is tapped, all land on the stored value instead of a
// stale copy from the last render. A deleted day starts again from empty.
export async function patchCheckin(
  db: LocalDb,
  userId: string,
  day: string,
  patch: CheckinPatch,
): Promise<void> {
  const id = await dailyId(userId, "checkin", day); // before the transaction (async crypto)
  await db.transaction("rw", db.checkins, db.outbox, async () => {
    const existing = (await db.checkins.get(id)) as CheckinRow | undefined;
    const current =
      existing && !existing.deleted_at ? toValues(existing) : EMPTY;
    const next = {
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    };
    await writeCheckin(db, id, day, next); // no awaits on anything but the database in here
  });
}

function writeCheckin(db: LocalDb, id: string, day: string, v: CheckinValues) {
  return saveRow(db, "checkins", {
    id,
    day,
    sleep_quality: v.sleepQuality,
    sleep_hours: v.sleepHours,
    energy: v.energy,
    motivation: v.motivation,
    hunger: v.hunger,
    symptoms: v.symptoms,
    note: v.note,
    deleted_at: null,
  } satisfies CheckinRow);
}

// Overwrites the whole day's check-in (use patchCheckin to change single fields).
export async function saveCheckin(
  db: LocalDb,
  userId: string,
  day: string,
  v: CheckinValues,
): Promise<void> {
  await writeCheckin(db, await dailyId(userId, "checkin", day), day, v);
}

export async function getWeight(
  db: LocalDb,
  userId: string,
  day: string,
): Promise<WeightRow | undefined> {
  const row = (await db.bodyweight_entries.get(
    await dailyId(userId, "weight", day),
  )) as WeightRow | undefined;
  return row && !row.deleted_at ? row : undefined;
}

// One weight per day: saving again replaces that day's value (and revives a deleted one).
export async function saveWeight(
  db: LocalDb,
  userId: string,
  day: string,
  kg: number,
): Promise<void> {
  await saveRow(db, "bodyweight_entries", {
    id: await dailyId(userId, "weight", day),
    day,
    weight_kg: kg,
    deleted_at: null,
  } satisfies WeightRow);
}

export async function removeWeight(
  db: LocalDb,
  userId: string,
  day: string,
): Promise<void> {
  const row = (await db.bodyweight_entries.get(
    await dailyId(userId, "weight", day),
  )) as WeightRow | undefined;
  if (row)
    await saveRow(db, "bodyweight_entries", {
      ...row,
      deleted_at: new Date().toISOString(),
    });
}

// One row per (kind, day), so logging the same event twice is harmless.
export async function saveCycleEvent(
  db: LocalDb,
  userId: string,
  kind: CycleEventRow["kind"],
  day: string,
): Promise<void> {
  await saveRow(db, "cycle_events", {
    id: await dailyId(userId, `cycle:${kind}`, day),
    kind,
    day,
    deleted_at: null,
  } satisfies CycleEventRow);
}

export async function removeCycleEvent(
  db: LocalDb,
  userId: string,
  kind: CycleEventRow["kind"],
  day: string,
): Promise<void> {
  const row = (await db.cycle_events.get(
    await dailyId(userId, `cycle:${kind}`, day),
  )) as CycleEventRow | undefined;
  if (row)
    await saveRow(db, "cycle_events", {
      ...row,
      deleted_at: new Date().toISOString(),
    });
}
