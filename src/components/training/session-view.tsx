"use client";

// Screen /training/session?id=...: log a workout (exercises, sets, rest timer, PR hints, save as template).
// Every edit is written to the local database immediately and shown through live queries; sync runs later in the background.
// Neighbours: exercise-card.tsx (one exercise with its sets and PR badges), exercise-picker.tsx, rest-timer.tsx, engine/session-hint.tsx, training-home.tsx, lib/local/workouts and prs.

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useLocal } from "@/components/local-provider";
import { SessionHint } from "@/components/engine/session-hint";
import { ExerciseCard } from "@/components/training/exercise-card";
import { ExercisePicker } from "@/components/training/exercise-picker";
import { primeAudio, RestTimer } from "@/components/training/rest-timer";
import { SyncStatus } from "@/components/training/sync-status";
import { buttonClass, secondaryButtonClass } from "@/components/ui";
import { prsForWorkout } from "@/lib/local/prs";
import { softDeleteWorkout } from "@/lib/local/repo";
import { saveWorkoutAsTemplate } from "@/lib/local/templates";
import type { SetRow, WorkoutExerciseRow, WorkoutRow } from "@/lib/local/types";
import {
  addExercise,
  addSet,
  finishWorkout,
  reopenWorkout,
} from "@/lib/local/workouts";
import type { PrKind } from "@/lib/workout/prs";
import { summarize } from "@/lib/workout/stats";
import { formatWeight, weightLabel } from "@/lib/workout/units";

// Default rest after each completed set.
const REST_SECONDS = 90;

export function SessionView() {
  const id = useSearchParams().get("id");
  const { db, units } = useLocal();
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

  const workout = useLiveQuery(
    async () =>
      db && id
        ? (((await db.workouts.get(id)) as WorkoutRow | undefined) ?? null)
        : undefined,
    [db, id],
  );
  const exercises = useLiveQuery(
    async () =>
      db && id
        ? ((await db.workout_exercises
            .where("workout_id")
            .equals(id)
            .filter((e) => !e.deleted_at)
            .sortBy("position")) as WorkoutExerciseRow[])
        : [],
    [db, id],
  );
  const totals = useLiveQuery(async () => {
    if (!db || !exercises?.length) return { workingSets: 0, volumeKg: 0 };
    const sets = (await db.workout_sets
      .where("workout_exercise_id")
      .anyOf(exercises.map((e) => e.id))
      .toArray()) as SetRow[];
    return summarize(sets);
  }, [db, exercises]);

  const prs = useLiveQuery(
    () => (db && id ? prsForWorkout(db, id) : new Map<string, PrKind[]>()),
    [db, id],
  );

  // Stable identity, so RestTimer's effect does not re-run on every parent render.
  const onRest = useCallback((v: number | null) => setRestEndsAt(v), []);

  // Early returns come after all hooks; they cover missing id, database not ready, loading and not found.
  if (!id) return <Message>Kein Training ausgewählt.</Message>;
  if (!db) return <StorageGate />;
  if (workout === undefined) return <Message>Lädt …</Message>;
  if (workout === null || workout.deleted_at)
    return <Message>Dieses Training wurde nicht gefunden.</Message>;

  const finished = Boolean(workout.ended_at);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-32 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{workout.title || "Training"}</h1>
        <SyncStatus />
      </div>
      <p className="text-sm text-neutral-600">
        {new Date(workout.started_at).toLocaleString("de-DE", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        {prs && prs.size > 0
          ? ` · 🏆 ${prs.size} ${prs.size === 1 ? "Bestleistung" : "Bestleistungen"}`
          : ""}
        {totals
          ? ` · ${totals.workingSets} Arbeitssätze · ${formatWeight(totals.volumeKg, units) || 0} ${weightLabel(units)} Volumen`
          : ""}
      </p>

      {!finished && <SessionHint />}

      {(exercises ?? []).map((ex) => (
        <ExerciseCard
          key={ex.id}
          db={db}
          exercise={ex}
          workoutId={workout.id}
          units={units}
          prs={prs}
          onSetDone={() => {
            primeAudio();
            setRestEndsAt(Date.now() + REST_SECONDS * 1000);
          }}
        />
      ))}

      {!finished && (
        <button
          onClick={() => setPicking(true)}
          className={secondaryButtonClass}
        >
          + Übung hinzufügen
        </button>
      )}

      <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
        {finished ? (
          <button
            onClick={() => reopenWorkout(db, workout.id)}
            className={secondaryButtonClass}
          >
            Training wieder öffnen
          </button>
        ) : (
          <button
            onClick={async () => {
              await finishWorkout(db, workout.id);
              router.push("/training");
            }}
            className={buttonClass}
          >
            Training beenden
          </button>
        )}
        <button
          onClick={async () => {
            const name = prompt(
              "Name der Vorlage",
              workout.title || "Training",
            );
            if (name?.trim()) await saveWorkoutAsTemplate(db, workout.id, name);
          }}
          className="text-sm underline"
        >
          Als Vorlage speichern
        </button>
        <button
          onClick={async () => {
            if (!confirm("Dieses Training endgültig löschen?")) return;
            await softDeleteWorkout(db, workout.id);
            router.push("/training");
          }}
          className="text-sm text-red-700 underline"
        >
          Training löschen
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={async (exerciseId) => {
            setPicking(false);
            const ex = await addExercise(db, workout.id, exerciseId);
            await addSet(db, ex.id);
          }}
        />
      )}
      {restEndsAt !== null && (
        <RestTimer endsAt={restEndsAt} onChange={onRest} />
      )}
    </main>
  );
}

// db is null during SSR/hydration; if it stays null the browser blocks local storage.
function StorageGate() {
  const [blocked] = useState(
    () => typeof window !== "undefined" && typeof indexedDB === "undefined",
  );
  return (
    <Message>
      {blocked
        ? "Dein Browser blockiert den lokalen Speicher (z. B. im privaten Modus). Bloom kann so nicht offline speichern."
        : "Lädt …"}
    </Message>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="p-8 text-neutral-600">{children}</p>;
}
