"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocal } from "@/components/local-provider";
import { SyncStatus } from "@/components/training/sync-status";
import { buttonClass } from "@/components/ui";
import type {
  SetRow,
  TemplateExerciseRow,
  TemplateRow,
  WorkoutRow,
} from "@/lib/local/types";
import {
  deleteTemplate,
  startWorkoutFromTemplate,
} from "@/lib/local/templates";
import { startWorkout } from "@/lib/local/workouts";
import { summarize } from "@/lib/workout/stats";
import { formatWeight, weightLabel } from "@/lib/workout/units";

export function TrainingHome() {
  const { db, units } = useLocal();
  const router = useRouter();

  const workouts = useLiveQuery(async () => {
    if (!db) return undefined;
    const rows = (await db.workouts
      .orderBy("started_at")
      .reverse()
      .filter((w) => !w.deleted_at)
      .limit(40)
      .toArray()) as WorkoutRow[];
    return Promise.all(
      rows.map(async (w) => {
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
        return { workout: w, exercises: exercises.length, ...summarize(sets) };
      }),
    );
  }, [db]);

  const templates = useLiveQuery(async () => {
    if (!db) return [];
    const rows = (await db.templates
      .filter((t) => !t.deleted_at)
      .toArray()) as TemplateRow[];
    return Promise.all(
      rows
        .sort((a, b) => a.name.localeCompare(b.name, "de"))
        .map(async (t) => ({
          template: t,
          exercises: (await db.template_exercises
            .where("template_id")
            .equals(t.id)
            .filter((e) => !e.deleted_at)
            .toArray()) as TemplateExerciseRow[],
        })),
    );
  }, [db]);

  const running = workouts?.find((w) => !w.workout.ended_at);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Training</h1>
        <SyncStatus />
      </div>

      {running ? (
        <Link
          href={`/training/session?id=${running.workout.id}`}
          className={`${buttonClass} text-center`}
        >
          Laufendes Training fortsetzen
        </Link>
      ) : (
        <button
          disabled={!db}
          onClick={async () => {
            if (!db) return;
            const w = await startWorkout(db);
            router.push(`/training/session?id=${w.id}`);
          }}
          className={buttonClass}
        >
          Training starten
        </button>
      )}

      {templates && templates.length > 0 && (
        <>
          <h2 className="mt-4 text-lg font-semibold">Vorlagen</h2>
          <ul className="flex flex-col gap-2">
            {templates.map(({ template, exercises }) => (
              <li
                key={template.id}
                className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex-1">
                  <p className="font-medium">{template.name}</p>
                  <p className="text-sm text-neutral-600">
                    {exercises.length}{" "}
                    {exercises.length === 1 ? "Übung" : "Übungen"}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!db) return;
                    const w = await startWorkoutFromTemplate(db, template.id);
                    router.push(`/training/session?id=${w.id}`);
                  }}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Starten
                </button>
                <button
                  onClick={() => {
                    if (db && confirm(`Vorlage „${template.name}“ löschen?`))
                      deleteTemplate(db, template.id);
                  }}
                  className="text-sm text-neutral-500 underline"
                  aria-label={`Vorlage ${template.name} löschen`}
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link href="/training/import" className="text-sm underline">
        Training aus Hevy oder Strong importieren
      </Link>

      <h2 className="mt-4 text-lg font-semibold">Verlauf</h2>
      {workouts === undefined ? (
        <p className="text-neutral-600">Lädt …</p>
      ) : workouts.length === 0 ? (
        <p className="text-neutral-600">
          Noch keine Trainings. Starte dein erstes oben.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {workouts.map(({ workout, exercises, workingSets, volumeKg }) => (
            <li key={workout.id}>
              <Link
                href={`/training/session?id=${workout.id}`}
                className="block rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex justify-between">
                  <span className="font-medium">
                    {workout.title || "Training"}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {new Date(workout.started_at).toLocaleDateString("de-DE", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-neutral-600">
                  {exercises} {exercises === 1 ? "Übung" : "Übungen"} ·{" "}
                  {workingSets}{" "}
                  {workingSets === 1 ? "Arbeitssatz" : "Arbeitssätze"} ·{" "}
                  {formatWeight(volumeKg, units) || 0} {weightLabel(units)}
                  {!workout.ended_at && " · läuft"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
