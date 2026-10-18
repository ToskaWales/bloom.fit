import { periodDaySet } from "@/lib/daily/cycle";
import { addDays, localDay } from "@/lib/daily/day";
import {
  buildOverview,
  type CheckinPoint,
  type OverviewRow,
} from "@/lib/daily/overview";
import { setVolume } from "@/lib/workout/stats";
import type { LocalDb } from "./db";
import type {
  CheckinRow,
  CycleEventRow,
  SetRow,
  WeightRow,
  WorkoutRow,
} from "./types";

interface Options {
  from: string;
  to: string;
  hideWeight: boolean;
}

// Everything the overview chart needs for [from, to], read from the local database.
export async function loadOverview(
  db: LocalDb,
  { from, to, hideWeight }: Options,
): Promise<OverviewRow[]> {
  const checkins = (
    (await db.checkins
      .where("day")
      .between(from, to, true, true)
      .toArray()) as CheckinRow[]
  )
    .filter((c) => !c.deleted_at)
    .map<CheckinPoint>((c) => ({
      day: c.day,
      energy: c.energy,
      motivation: c.motivation,
      sleep_quality: c.sleep_quality,
      sleep_hours: c.sleep_hours,
      hunger: c.hunger,
      symptoms: c.symptoms,
    }));

  const weights = hideWeight
    ? []
    : (
        (await db.bodyweight_entries
          .filter((w) => !w.deleted_at)
          .toArray()) as WeightRow[]
      ).map((w) => ({
        day: w.day,
        kg: Number(w.weight_kg),
      }));

  const events = (
    (await db.cycle_events
      .filter((e) => !e.deleted_at)
      .toArray()) as CycleEventRow[]
  ).map((e) => ({
    kind: e.kind,
    day: e.day,
  }));

  // Pad by a day each side, then filter on the *local* day (started_at is a UTC instant).
  const lower = new Date(`${addDays(from, -1)}T00:00:00`).toISOString();
  const upper = new Date(`${addDays(to, 2)}T00:00:00`).toISOString();
  const workouts = (
    (await db.workouts
      .where("started_at")
      .between(lower, upper, true, true)
      .toArray()) as WorkoutRow[]
  )
    .filter((w) => !w.deleted_at)
    .map((w) => ({ id: w.id, day: localDay(new Date(w.started_at)) }))
    .filter((w) => w.day >= from && w.day <= to);

  const volumes: { day: string; volumeKg: number }[] = [];
  for (const w of workouts) {
    const exercises = await db.workout_exercises
      .where("workout_id")
      .equals(w.id)
      .filter((e) => !e.deleted_at)
      .toArray();
    const sets = exercises.length
      ? ((await db.workout_sets
          .where("workout_exercise_id")
          .anyOf(exercises.map((e) => e.id))
          .toArray()) as SetRow[])
      : [];
    volumes.push({
      day: w.day,
      volumeKg: sets.reduce((sum, s) => sum + setVolume(s), 0),
    });
  }

  return buildOverview({
    from,
    to,
    checkins,
    weights,
    workouts: volumes,
    periodDays: periodDaySet(events),
  });
}
