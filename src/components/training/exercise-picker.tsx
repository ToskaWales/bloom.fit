"use client";

// Full-screen search dialog for adding an exercise to a running workout (opened from session-view.tsx).
// Searches the built-in catalog plus her custom exercises from the local database; can create a custom exercise.
// No server calls. Neighbours: lib/exercises (catalog, match), lib/local/repo (saveRow).

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useLocal } from "@/components/local-provider";
import { inputClass } from "@/components/ui";
import { MUSCLE_LABELS } from "@/lib/exercises/catalog";
import { searchExercises } from "@/lib/exercises/match";
import type { CustomExerciseRow } from "@/lib/local/types";
import { saveRow } from "@/lib/local/repo";

// Case- and space-insensitive comparison for the 'already exists' check.
const norm = (s: string) => s.trim().toLowerCase();

export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const { db } = useLocal();
  const [query, setQuery] = useState("");
  const custom = useLiveQuery(
    async () =>
      db
        ? ((await db.custom_exercises
            .filter((e) => !e.deleted_at)
            .toArray()) as CustomExerciseRow[])
        : [],
    [db],
  );
  const catalog = searchExercises(query);
  const customMatches = (custom ?? []).filter(
    (e) => !query || norm(e.name).includes(norm(query)),
  );
  // Hides the 'create custom exercise' row when the typed name already exists.
  const exact = [
    ...catalog.map((e) => e.name),
    ...(custom ?? []).map((e) => e.name),
  ].some((n) => norm(n) === norm(query));

  async function createCustom() {
    if (!db || !query.trim()) return;
    const id = crypto.randomUUID();
    await saveRow(db, "custom_exercises", {
      id,
      name: query.trim().slice(0, 80),
      muscle_group: null,
      equipment: null,
      deleted_at: null,
    });
    onPick(id);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Übung hinzufügen"
      className="fixed inset-0 z-20 flex flex-col bg-white"
    >
      <div className="flex items-center gap-2 border-b border-neutral-200 p-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Übung suchen (z. B. Kniebeuge)"
          className={`${inputClass} flex-1`}
        />
        <button onClick={onClose} className="px-2 py-2 text-sm underline">
          Abbrechen
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {query.trim() && !exact && (
          <li>
            <button
              onClick={createCustom}
              className="w-full border-b border-neutral-100 px-4 py-3 text-left text-rose-700"
            >
              + Eigene Übung „{query.trim()}“ anlegen
            </button>
          </li>
        )}
        {customMatches.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => onPick(e.id)}
              className="w-full border-b border-neutral-100 px-4 py-3 text-left"
            >
              {e.name}
              <span className="ml-2 text-xs text-neutral-500">
                Eigene Übung
              </span>
            </button>
          </li>
        ))}
        {catalog.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => onPick(e.id)}
              className="w-full border-b border-neutral-100 px-4 py-3 text-left"
            >
              {e.name}
              <span className="ml-2 text-xs text-neutral-500">
                {MUSCLE_LABELS[e.muscle]}
              </span>
            </button>
          </li>
        ))}
        {catalog.length === 0 &&
          customMatches.length === 0 &&
          !query.trim() && (
            <li className="p-4 text-sm text-neutral-600">
              Keine Übungen gefunden.
            </li>
          )}
      </ul>
    </div>
  );
}
