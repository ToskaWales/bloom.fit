import { dailyId } from "@/lib/ids";
import type { Symptom } from "@/lib/daily/symptoms";
import type { LocalDb } from "./db";
import { saveRow } from "./repo";
import type { CheckinRow, CycleEventRow, WeightRow } from "./types";

// The row id is derived from user + day, so it is computed before any database
// transaction starts (awaiting crypto inside a Dexie transaction would end it).

export interface CheckinValues {
  sleepQuality: number | null;
  sleepHours: number | null;
  energy: number | null;
  motivation: number | null;
  hunger: number | null;
  symptoms: Symptom[];
  note: string | null;
}

export async function getCheckin(
  db: LocalDb,
  userId: string,
  day: string,
): Promise<CheckinRow | undefined> {
  const row = (await db.checkins.get(await dailyId(userId, "checkin", day))) as
    CheckinRow | undefined;
  return row && !row.deleted_at ? row : undefined;
}

export async function saveCheckin(
  db: LocalDb,
  userId: string,
  day: string,
  v: CheckinValues,
): Promise<void> {
  await saveRow(db, "checkins", {
    id: await dailyId(userId, "checkin", day),
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
