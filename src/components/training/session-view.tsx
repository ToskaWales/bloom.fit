"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useLocal } from "@/components/local-provider";
import { ExercisePicker } from "@/components/training/exercise-picker";
import { primeAudio, RestTimer } from "@/components/training/rest-timer";
import { SyncStatus } from "@/components/training/sync-status";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { getCatalogExercise } from "@/lib/exercises/catalog";
import type { LocalDb } from "@/lib/local/db";
import { prsForWorkout } from "@/lib/local/prs";
import { softDeleteWorkout } from "@/lib/local/repo";
import { saveWorkoutAsTemplate } from "@/lib/local/templates";
import type {
  CustomExerciseRow,
  SetRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from "@/lib/local/types";
import {
  addExercise,
  addSet,
  finishWorkout,
  lastPerformance,
  removeExercise,
  removeSet,
  reopenWorkout,
  updateSet,
} from "@/lib/local/workouts";
import type { PrKind } from "@/lib/workout/prs";
import { summarize } from "@/lib/workout/stats";
import {
  formatWeight,
  parseWeightInput,
  weightLabel,
  type Units,
} from "@/lib/workout/units";

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

  const onRest = useCallback((v: number | null) => setRestEndsAt(v), []);

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

function ExerciseCard({
  db,
  exercise,
  workoutId,
  units,
  prs,
  onSetDone,
}: {
  db: LocalDb;
  exercise: WorkoutExerciseRow;
  workoutId: string;
  units: Units;
  prs: Map<string, PrKind[]> | undefined;
  onSetDone: () => void;
}) {
  const catalog = getCatalogExercise(exercise.exercise_id);
  const custom = useLiveQuery(
    async () =>
      catalog
        ? null
        : (((await db.custom_exercises.get(exercise.exercise_id)) as
            CustomExerciseRow | undefined) ?? null),
    [db, exercise.exercise_id, catalog],
  );
  const sets = useLiveQuery(
    async () =>
      (await db.workout_sets
        .where("workout_exercise_id")
        .equals(exercise.id)
        .filter((s) => !s.deleted_at)
        .sortBy("position")) as SetRow[],
    [db, exercise.id],
  );
  const last = useLiveQuery(
    () => lastPerformance(db, exercise.exercise_id, workoutId),
    [db, exercise.exercise_id, workoutId],
  );

  const name = catalog?.name ?? custom?.name ?? "Übung";
  const lastText = (last ?? [])
    .filter((s) => s.set_type !== "warmup")
    .map((s) => `${formatWeight(s.weight_kg, units) || "–"}×${s.reps ?? "–"}`)
    .join(", ");

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{name}</h2>
          {lastText && (
            <p className="text-xs text-neutral-500">Letztes Mal: {lastText}</p>
          )}
        </div>
        <button
          onClick={() => {
            if (confirm(`„${name}“ aus diesem Training entfernen?`))
              removeExercise(db, exercise.id);
          }}
          className="text-xs text-neutral-500 underline"
          aria-label={`${name} entfernen`}
        >
          Entfernen
        </button>
      </div>

      <div className="grid grid-cols-[1.5rem_1fr_1fr_3.25rem_2.75rem_1.25rem] items-center gap-2 text-xs text-neutral-500">
        <span>Satz</span>
        <span>{weightLabel(units)}</span>
        <span>Wdh.</span>
        <span>RPE</span>
        <span />
        <span />
      </div>
      <div className="flex flex-col gap-2">
        {(sets ?? []).map((s, i) => (
          <SetLine
            key={s.id}
            db={db}
            set={s}
            index={i}
            units={units}
            onDone={onSetDone}
          />
        ))}
      </div>
      {(sets ?? []).map((s, i) =>
        prs?.has(s.id) ? (
          <p key={`pr-${s.id}`} className="mt-2 text-sm text-amber-700">
            🏆 Satz {i + 1}: neue Bestleistung (
            {prs
              .get(s.id)!
              .map((k) => (k === "weight" ? "Gewicht" : "geschätztes 1RM"))
              .join(" und ")}
            )
          </p>
        ) : null,
      )}
      <button
        onClick={() => addSet(db, exercise.id)}
        className="mt-3 w-full rounded-xl bg-neutral-100 py-2 text-sm font-medium"
      >
        + Satz
      </button>
    </section>
  );
}

const cell = `${inputClass} w-full px-2 py-2 text-center`;

function SetLine({
  db,
  set,
  index,
  units,
  onDone,
}: {
  db: LocalDb;
  set: SetRow;
  index: number;
  units: Units;
  onDone: () => void;
}) {
  const warmup = set.set_type === "warmup";

  function commitWeight(e: React.FocusEvent<HTMLInputElement>) {
    // Leaving the field untouched must not rewrite the weight (lbs display is rounded).
    if (e.currentTarget.value.trim() === formatWeight(set.weight_kg, units))
      return;
    const kg = parseWeightInput(e.currentTarget.value, units);
    if (kg === undefined) {
      e.currentTarget.value = formatWeight(set.weight_kg, units);
      return;
    }
    if (kg !== set.weight_kg) updateSet(db, set.id, { weight_kg: kg });
  }
  function commitReps(e: React.FocusEvent<HTMLInputElement>) {
    const text = e.currentTarget.value.trim();
    if (text === (set.reps == null ? "" : String(set.reps))) return;
    if (text !== "" && !/^\d{1,4}$/.test(text)) {
      e.currentTarget.value = set.reps == null ? "" : String(set.reps);
      return;
    }
    updateSet(db, set.id, { reps: text === "" ? null : Number(text) });
  }
  function commitRpe(e: React.FocusEvent<HTMLInputElement>) {
    const text = e.currentTarget.value.trim().replace(",", ".");
    if (text === (set.rpe == null ? "" : String(set.rpe))) return;
    const rpe =
      text === "" ? null : /^\d{1,2}(\.\d)?$/.test(text) ? Number(text) : NaN;
    if (rpe !== null && !(rpe >= 1 && rpe <= 10)) {
      e.currentTarget.value = set.rpe == null ? "" : String(set.rpe);
      return;
    }
    updateSet(db, set.id, { rpe });
  }

  return (
    <div className="grid grid-cols-[1.5rem_1fr_1fr_3.25rem_2.75rem_1.25rem] items-center gap-2">
      <button
        onClick={() =>
          updateSet(db, set.id, { set_type: warmup ? "normal" : "warmup" })
        }
        className={`text-sm font-semibold ${warmup ? "text-amber-600" : "text-neutral-700"}`}
        aria-label={
          warmup
            ? "Aufwärmsatz (zum Arbeitssatz ändern)"
            : "Arbeitssatz (zum Aufwärmsatz ändern)"
        }
        title="Tippen: Aufwärmsatz an/aus"
      >
        {warmup ? "W" : index + 1}
      </button>
      <input
        key={`w:${set.weight_kg}`}
        aria-label="Gewicht"
        inputMode="decimal"
        defaultValue={formatWeight(set.weight_kg, units)}
        onBlur={commitWeight}
        className={cell}
      />
      <input
        key={`r:${set.reps}`}
        aria-label="Wiederholungen"
        inputMode="numeric"
        defaultValue={set.reps ?? ""}
        onBlur={commitReps}
        className={cell}
      />
      <input
        key={`p:${set.rpe}`}
        aria-label="RPE (optional)"
        inputMode="decimal"
        defaultValue={set.rpe ?? ""}
        onBlur={commitRpe}
        className={cell}
        placeholder="–"
      />
      <button
        onClick={async () => {
          const next = !set.completed;
          await updateSet(db, set.id, { completed: next });
          if (next) onDone();
        }}
        aria-label={
          set.completed ? "Satz als offen markieren" : "Satz abschließen"
        }
        aria-pressed={set.completed}
        className={`h-11 rounded-xl text-lg ${set.completed ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-500"}`}
      >
        ✓
      </button>
      <button
        onClick={() => removeSet(db, set.id)}
        className="text-lg leading-none text-neutral-400 hover:text-red-700"
        aria-label={`Satz ${index + 1} löschen`}
      >
        ×
      </button>
    </div>
  );
}
