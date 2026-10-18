"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocal } from "@/components/local-provider";
import { useCycleEvents } from "@/components/daily/use-daily-data";
import { SyncStatus } from "@/components/training/sync-status";
import { inputClass, Notice, secondaryButtonClass } from "@/components/ui";
import { summarizeCycle, type CycleEvent } from "@/lib/daily/cycle";
import { useToday } from "@/components/daily/use-today";
import { addDays, daysBetween } from "@/lib/daily/day";
import { isValidCycleDay, isValidPeriodEnd } from "@/lib/daily/validate";
import { removeCycleEvent, saveCycleEvent } from "@/lib/local/daily";

const LABEL: Record<CycleEvent["kind"], string> = {
  period_start: "Periode begonnen",
  period_end: "Periode zu Ende",
  ovulation_test_positive: "Ovulationstest positiv",
};
const fmt = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function CycleView() {
  const { db, userId, cycleMode } = useLocal();
  const events = useCycleEvents();
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? today;
  const [error, setError] = useState<string | null>(null);

  if (cycleMode !== "natural" && cycleMode !== "irregular") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-8">
        <h1 className="text-2xl font-bold">Zyklus</h1>
        <p className="text-neutral-700">
          Du hast für deinen Zyklus keine Protokollierung ausgewählt. In den{" "}
          <Link href="/einstellungen" className="underline">
            Einstellungen
          </Link>{" "}
          kannst du das jederzeit ändern.
        </p>
      </main>
    );
  }

  if (!today) return <p className="p-8 text-neutral-600">Lädt …</p>;
  const summary = summarizeCycle(events ?? [], today);

  async function log(kind: CycleEvent["kind"]) {
    if (!db) return;
    if (!isValidCycleDay(day, today))
      return setError(
        "Bitte wähle ein Datum innerhalb des letzten Jahres, nicht in der Zukunft.",
      );
    if (kind === "period_end") {
      const start = (events ?? [])
        .filter((e) => e.kind === "period_start" && e.day <= day)
        .map((e) => e.day)
        .sort()
        .at(-1);
      if (!start || !isValidPeriodEnd(start, day))
        return setError(
          "Das Ende muss nach dem Beginn einer Periode liegen (höchstens 14 Tage danach).",
        );
    }
    if (kind === "period_start") {
      const near = (events ?? []).some(
        (e) =>
          e.kind === "period_start" &&
          e.day !== day &&
          Math.abs(daysBetween(e.day, day)) < 14,
      );
      if (near)
        return setError(
          "In den 14 Tagen um dieses Datum gibt es schon einen Periodenbeginn. Lösche ihn zuerst, wenn er falsch war.",
        );
    }
    setError(null);
    await saveCycleEvent(db, userId, kind, day);
  }

  const list = [...(events ?? [])]
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, 40);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zyklus-Protokoll</h1>
        <SyncStatus />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Datum
          <input
            type="date"
            value={day}
            min={addDays(today, -365)}
            max={today}
            onChange={(e) => setPicked(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LABEL) as CycleEvent["kind"][]).map((k) => (
            <button
              key={k}
              onClick={() => log(k)}
              className={secondaryButtonClass}
            >
              {LABEL[k]}
            </button>
          ))}
        </div>
        {error && <Notice>{error}</Notice>}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-lg font-semibold">Deine Zyklen</h2>
        {summary.lengths.length === 0 ? (
          <p className="text-neutral-700">
            Sobald du mindestens zwei Periodenstarts eingetragen hast, siehst du
            hier deine Zykluslängen.
          </p>
        ) : (
          <ul className="text-neutral-700">
            <li>
              {summary.lengths.length} erfasste{" "}
              {summary.lengths.length === 1 ? "Zyklus" : "Zyklen"}, typische
              Länge {summary.medianLength} Tage (kürzester{" "}
              {Math.min(...summary.lengths)}, längster{" "}
              {Math.max(...summary.lengths)}).
            </li>
            {summary.periodLengths.length > 0 && (
              <li>
                Periode dauert meist{" "}
                {Math.round(
                  summary.periodLengths.reduce((a, b) => a + b, 0) /
                    summary.periodLengths.length,
                )}{" "}
                Tage.
              </li>
            )}
          </ul>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          Zykluslängen unter 18 oder über 60 Tagen zählt Bloom nicht mit, weil
          dann meist ein Eintrag fehlt. Das ist keine Diagnose und keine
          Verhütungsmethode.
        </p>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">Einträge</h2>
        {events === undefined ? (
          <p className="text-neutral-600">Lädt …</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-neutral-700">Noch keine Einträge.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {list.map((e) => (
              <li
                key={`${e.kind}:${e.day}`}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>
                  {fmt(e.day)} · {LABEL[e.kind]}
                </span>
                <button
                  onClick={() =>
                    db && removeCycleEvent(db, userId, e.kind, e.day)
                  }
                  className="text-neutral-500 underline"
                  aria-label={`${LABEL[e.kind]} am ${fmt(e.day)} löschen`}
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
