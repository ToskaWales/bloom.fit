"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocal } from "@/components/local-provider";
import { buttonClass, Notice, secondaryButtonClass } from "@/components/ui";
import { matchExercise } from "@/lib/exercises/match";
import { runImport, type ImportSummary } from "@/lib/import/build";
import { parseWorkoutFile } from "@/lib/import/parsers";

const MAX_BYTES = 25 * 1024 * 1024;
const FORMAT_LABEL = {
  hevy: "Hevy",
  strong: "Strong",
  unknown: "unbekannt",
} as const;

export function ImportView() {
  const { db } = useLocal();
  const [text, setText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [units, setUnits] = useState<"kg" | "lbs">("kg");
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [failed, setFailed] = useState(false);

  const parsed = useMemo(
    () => (text ? parseWorkoutFile(text, units) : null),
    [text, units],
  );
  const stats = useMemo(() => {
    if (!parsed || parsed.workouts.length === 0) return null;
    const names = new Set(
      parsed.workouts.flatMap((w) => w.exercises.map((e) => e.name)),
    );
    const dates = parsed.workouts.map((w) => w.startedAt).sort();
    return {
      workouts: parsed.workouts.length,
      sets: parsed.workouts.reduce(
        (n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0),
        0,
      ),
      exercises: names.size,
      unmatched: [...names].filter((n) => !matchExercise(n)).sort(),
      from: new Date(dates[0]).toLocaleDateString("de-DE"),
      to: new Date(dates[dates.length - 1]).toLocaleDateString("de-DE"),
    };
  }, [parsed]);

  async function onFile(file: File | undefined) {
    setSummary(null);
    setFailed(false);
    setFileError(null);
    setText(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setFileError("Die Datei ist größer als 25 MB.");
      return;
    }
    setText(await file.text());
  }

  async function start() {
    if (!db || !parsed) return;
    setFailed(false);
    setProgress([0, parsed.workouts.length]);
    try {
      setSummary(
        await runImport(db, parsed.workouts, {
          onProgress: (done, total) => setProgress([done, total]),
        }),
      );
    } catch (err) {
      console.error(
        "import failed",
        err instanceof Error ? err.message : "unknown",
      );
      setFailed(true);
    } finally {
      setProgress(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Training importieren</h1>
      <p className="text-neutral-700">
        Lade den CSV-Export aus Hevy oder Strong hoch. Er enthält deine
        bisherigen Trainings, und alles bleibt auf deinem Gerät, bis es mit
        deinem Bloom-Konto synchronisiert wird.
      </p>
      <p className="text-sm text-neutral-600">
        Den Export findest du in der jeweiligen App unter den Einstellungen
        („Daten exportieren“, die Menünamen können abweichen). Mehrfaches
        Importieren derselben Datei erzeugt keine Duplikate.
      </p>

      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => onFile(e.target.files?.[0])}
        className="rounded-xl border border-neutral-300 bg-white p-3"
        aria-label="CSV-Datei auswählen"
      />
      {fileError && <Notice>{fileError}</Notice>}

      {parsed?.format === "unknown" && (
        <Notice>
          Das Dateiformat wurde nicht erkannt. Bloom unterstützt den CSV-Export
          von Hevy und Strong.
        </Notice>
      )}

      {parsed && parsed.format !== "unknown" && (
        <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="font-medium">Erkannt: {FORMAT_LABEL[parsed.format]}</p>

          {parsed.format === "strong" && (
            <fieldset className="flex gap-4 text-sm">
              <legend className="mb-1 font-medium">
                In welcher Einheit sind die Gewichte exportiert?
              </legend>
              {(["kg", "lbs"] as const).map((u) => (
                <label key={u} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="units"
                    checked={units === u}
                    onChange={() => setUnits(u)}
                  />
                  {u}
                </label>
              ))}
            </fieldset>
          )}

          {stats ? (
            <ul className="text-sm text-neutral-700">
              <li>
                {stats.workouts} Trainings ({stats.from} bis {stats.to})
              </li>
              <li>
                {stats.sets} Sätze, {stats.exercises} verschiedene Übungen
              </li>
              {stats.unmatched.length > 0 && (
                <li>
                  {stats.unmatched.length} Übungen sind nicht im Bloom-Katalog
                  und werden als eigene Übungen angelegt:{" "}
                  {stats.unmatched.slice(0, 12).join(", ")}
                  {stats.unmatched.length > 12 ? " …" : ""}
                </li>
              )}
            </ul>
          ) : (
            <Notice>
              In der Datei wurden keine importierbaren Trainings gefunden.
            </Notice>
          )}
          {parsed.warnings.map((w) => (
            <p key={w} className="text-sm text-amber-700">
              {w}
            </p>
          ))}

          {stats && !summary && (
            <button
              onClick={start}
              disabled={!db || progress !== null}
              className={buttonClass}
            >
              {progress
                ? `Importiere … ${progress[0]} von ${progress[1]}`
                : `${stats.workouts} Trainings importieren`}
            </button>
          )}
        </section>
      )}

      {failed && (
        <Notice>
          Der Import ist fehlgeschlagen. Bereits importierte Trainings bleiben
          erhalten, du kannst es erneut versuchen.
        </Notice>
      )}
      {summary && (
        <Notice tone="info">
          {summary.imported} Trainings importiert ({summary.sets} Sätze
          {summary.customExercises
            ? `, ${summary.customExercises} neue eigene Übungen`
            : ""}
          )
          {summary.skippedExisting
            ? `, ${summary.skippedExisting} waren schon vorhanden`
            : ""}
          . Die Daten werden jetzt synchronisiert.
        </Notice>
      )}

      <Link href="/training" className={`${secondaryButtonClass} text-center`}>
        Zurück zum Training
      </Link>
    </main>
  );
}
