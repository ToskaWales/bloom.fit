"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useLocal } from "@/components/local-provider";
import Link from "next/link";
import {
  useReadinessParts,
  useSuggestions,
} from "@/components/engine/use-suggestions";
import { getCatalogExercise } from "@/lib/exercises/catalog";
import { renderSuggestion, type RenderedSuggestion } from "@/lib/engine/texts";
import { reactToSuggestion } from "@/lib/local/suggestions";
import type { CustomExerciseRow, SuggestionRow } from "@/lib/local/types";

export function useExerciseNames() {
  const { db } = useLocal();
  const custom = useLiveQuery(
    async () =>
      db ? ((await db.custom_exercises.toArray()) as CustomExerciseRow[]) : [],
    [db],
  );
  const name = (id: string) =>
    getCatalogExercise(id)?.name ??
    custom?.find((c) => c.id === id)?.name ??
    "Übung";
  // custom exercises load asynchronously: don't flash a wrong name meanwhile
  return { name, ready: custom !== undefined };
}

export function SuggestionsCard({ today }: { today: string }) {
  const { db, units } = useLocal();
  const rows = useSuggestions(today);
  const names = useExerciseNames();
  const readinessParts = useReadinessParts(today);
  const safetyActive = (rows ?? []).some(
    (r) => r.kind === "safety" && r.status !== "dismissed",
  );
  const items = (rows ?? [])
    .filter((r) => r.status !== "dismissed")
    .map((row) => ({
      row,
      rendered: renderSuggestion(
        { kind: row.kind, subject: row.subject, params: row.params },
        {
          units,
          exerciseName: names.name,
          readinessParts: readinessParts ?? undefined,
          safetyActive,
        },
      ),
    }))
    .filter(
      (i): i is { row: SuggestionRow; rendered: RenderedSuggestion } =>
        i.rendered !== null,
    );
  if (!db || !names.ready || items.length === 0) return null;

  return (
    <section
      aria-labelledby="suggestions-title"
      className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"
    >
      <h2 id="suggestions-title" className="text-lg font-semibold">
        Für dich heute
      </h2>
      {items.map(({ row, rendered }) => (
        <SuggestionItem
          key={row.id}
          row={row}
          r={rendered}
          onReact={(s) => void reactToSuggestion(db, row.id, s).catch(() => {})}
        />
      ))}
    </section>
  );
}

function SuggestionItem({
  row,
  r,
  onReact,
}: {
  row: SuggestionRow;
  r: RenderedSuggestion;
  onReact: (status: "accepted" | "dismissed") => void;
}) {
  const accepted = row.status === "accepted";
  return (
    <article className="flex flex-col gap-2 rounded-xl bg-white p-3 text-sm">
      <h3 className="font-semibold">{r.title}</h3>
      {!accepted && <p className="text-neutral-700">{r.body}</p>}
      <details>
        <summary className="cursor-pointer text-neutral-600 underline">
          Warum sehe ich das?
        </summary>
        <ul className="mt-2 list-disc pl-5 text-neutral-700">
          {r.because.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-neutral-500">
          Bloom rechnet das auf deinem Gerät aus deinen eigenen Einträgen. Es
          ist ein Vorschlag, keine Regel und kein medizinischer Rat.
        </p>
      </details>
      {row.kind === "pattern" && (
        <Link href="/muster" className="text-neutral-600 underline">
          Alle Muster ansehen
        </Link>
      )}
      {accepted ? (
        <p className="text-xs text-neutral-500">Notiert.</p>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onReact("accepted")}
            className="rounded-xl bg-rose-600 px-3 py-2 font-semibold text-white"
          >
            {r.acceptLabel ?? "Verstanden"}
          </button>
          <button
            onClick={() => onReact("dismissed")}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2"
          >
            Passt nicht
          </button>
        </div>
      )}
    </article>
  );
}
