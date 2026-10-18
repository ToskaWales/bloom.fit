"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { useLocal } from "@/components/local-provider";
import { OverviewChart } from "@/components/daily/overview-chart";
import { SyncStatus } from "@/components/training/sync-status";
import { addDays, localDay } from "@/lib/daily/day";
import { SYMPTOM_LABELS, type Symptom } from "@/lib/daily/symptoms";
import { loadOverview } from "@/lib/local/overview-data";
import { formatWeight, weightLabel } from "@/lib/workout/units";

const WINDOWS = [4, 8, 12] as const;

export function OverviewView() {
  const { db, units, hideWeight, cycleMode } = useLocal();
  const [weeks, setWeeks] = useState<(typeof WINDOWS)[number]>(8);
  const to = localDay();
  const from = addDays(to, -(weeks * 7 - 1));

  const rows = useLiveQuery(
    () => (db ? loadOverview(db, { from, to, hideWeight }) : undefined),
    [db, from, to, hideWeight],
  );
  const hasData = rows?.some(
    (r) =>
      r.energy !== null ||
      r.motivation !== null ||
      r.sleepQuality !== null ||
      r.weightKg !== null ||
      r.volumeKg > 0,
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Verlauf</h1>
        <SyncStatus />
      </div>
      <p className="text-neutral-700">
        Alles an einem Ort: wie du dich fühlst, wie sich dein Gewicht entwickelt
        und was du trainierst, mit deinen Periodentagen markiert. So erkennst du
        eigene Muster, ohne selbst zwischen Apps zu vergleichen.
      </p>

      <div role="group" aria-label="Zeitraum" className="flex gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w}
            aria-pressed={weeks === w}
            onClick={() => setWeeks(w)}
            className={`rounded-full border px-3 py-1.5 text-sm ${weeks === w ? "border-rose-600 bg-rose-50 text-rose-800" : "border-neutral-300 bg-white"}`}
          >
            {w} Wochen
          </button>
        ))}
      </div>

      {rows === undefined ? (
        <p className="text-neutral-600">Lädt …</p>
      ) : !hasData ? (
        <p className="rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-700">
          In diesem Zeitraum gibt es noch keine Einträge. Trage auf der
          Startseite deinen Check-in ein und logge dein Training, dann erscheint
          hier dein Verlauf.
        </p>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white p-3">
          <OverviewChart rows={rows} showWeight={!hideWeight} units={units} />
        </div>
      )}

      {cycleMode === "natural" || cycleMode === "irregular" ? (
        <Link href="/zyklus" className="text-sm underline">
          Zyklus-Protokoll öffnen
        </Link>
      ) : null}

      {rows && hasData && (
        <details className="rounded-2xl border border-neutral-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Werte als Tabelle anzeigen
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="py-1 pr-2">Datum</th>
                  <th className="px-2">Energie</th>
                  <th className="px-2">Motivation</th>
                  <th className="px-2">Schlaf</th>
                  {!hideWeight && (
                    <th className="px-2">Gewicht ({weightLabel(units)})</th>
                  )}
                  {!hideWeight && <th className="px-2">Trend</th>}
                  <th className="px-2">Volumen</th>
                  <th className="px-2">Periode</th>
                  <th className="px-2">Beschwerden</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.day} className="border-b border-neutral-100">
                    <th scope="row" className="py-1 pr-2 font-normal">
                      {new Date(`${r.day}T12:00:00`).toLocaleDateString(
                        "de-DE",
                        { weekday: "short", day: "2-digit", month: "2-digit" },
                      )}
                    </th>
                    <td className="px-2">{r.energy ?? "–"}</td>
                    <td className="px-2">{r.motivation ?? "–"}</td>
                    <td className="px-2">{r.sleepQuality ?? "–"}</td>
                    {!hideWeight && (
                      <td className="px-2">
                        {r.weightKg !== null
                          ? formatWeight(r.weightKg, units)
                          : "–"}
                      </td>
                    )}
                    {!hideWeight && (
                      <td className="px-2">
                        {r.weightTrend !== null
                          ? formatWeight(r.weightTrend, units)
                          : "–"}
                      </td>
                    )}
                    <td className="px-2">
                      {r.volumeKg ? formatWeight(r.volumeKg, units) : "–"}
                    </td>
                    <td className="px-2">{r.period ? "ja" : ""}</td>
                    <td className="px-2">
                      {r.symptoms
                        .map((s) => SYMPTOM_LABELS[s as Symptom] ?? s)
                        .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </main>
  );
}
