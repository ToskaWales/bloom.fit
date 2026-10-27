"use client";

// Screen /muster: shows patterns around the period that the on-device engine found in her own data.
// Reads check-ins, workouts etc. from the local database (loadEngineData) and runs the pure analysis locally; no server calls.
// Neighbours: lib/engine/patterns and texts, use-today.ts. Shows 'no clear pattern' as a normal result, never a verdict.

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useToday } from "@/components/daily/use-today";
import { useLocal } from "@/components/local-provider";
import { SyncStatus } from "@/components/training/sync-status";
import {
  WINDOW_DAYS,
  type PatternAnalysis,
  type PatternFinding,
} from "@/lib/engine/patterns";
import { describeFinding } from "@/lib/engine/texts";
import { loadEngineData, patternsFrom } from "@/lib/local/engine-data";

const fmtDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });

export function MusterView() {
  const { db, cycleMode, hideWeight } = useLocal();
  const today = useToday();
  const tracksCycle = cycleMode === "natural" || cycleMode === "irregular";

  // undefined means loading or not applicable; the render below distinguishes both.
  const analysis = useLiveQuery(async (): Promise<
    PatternAnalysis | undefined
  > => {
    if (!db || !today || !tracksCycle) return undefined;
    return patternsFrom(await loadEngineData(db, today, hideWeight), today);
  }, [db, today, tracksCycle, hideWeight]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Muster</h1>
        <SyncStatus />
      </div>

      <p className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
        Die Forschung ist bei einem Punkt klar: Zykluseffekte unterscheiden sich
        stark zwischen Frauen. Deshalb passt sich Bloom deinen Daten an, nicht
        einem festen Phasenkalender.
      </p>

      {!tracksCycle ? (
        <p className="text-neutral-700">
          Muster rund um deine Periode brauchen dein Zyklus-Protokoll. Du kannst
          es in den Einstellungen einschalten.{" "}
          <Link href="/einstellungen" className="underline">
            Zu den Einstellungen
          </Link>
        </p>
      ) : analysis === undefined ? (
        <p className="text-neutral-600">Lädt …</p>
      ) : (
        <Result analysis={analysis} />
      )}

      <details className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
        <summary className="cursor-pointer font-medium">
          So sucht Bloom nach Mustern
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <p>
            Bloom vergleicht für jeden Zyklus die {WINDOW_DAYS.before} Tage vor
            deiner Periode und die ersten {WINDOW_DAYS.start} Tage deiner
            Periode mit deinen übrigen Tagen. Das geschieht auf deinem Gerät,
            aus deinen eigenen Einträgen: Energie, Motivation, Schlaf, Hunger
            und deiner Trainingsleistung im Vergleich zu deinem üblichen Niveau.
          </p>
          <p>
            Ein Muster zeigt Bloom nur, wenn der Unterschied spürbar ist, in
            jedem ausgewerteten Zyklus in dieselbe Richtung ging und nicht gut
            durch Zufall zu erklären ist. Ein Muster heißt nicht, dass etwas
            „richtig“ oder „falsch“ ist, und es sagt nichts über den nächsten
            Zyklus. „Kein klares Muster“ ist ein genauso gutes Ergebnis: Dann
            richtet sich Bloom weiter nach deinem Tag.
          </p>
        </div>
      </details>
    </main>
  );
}

// Three outcomes: still collecting data, no clear pattern, or findings. All wording comes from lib/engine/texts.
function Result({ analysis }: { analysis: PatternAnalysis }) {
  if (analysis.status === "collecting") {
    return (
      <section className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Bloom sammelt noch</h2>
        <p className="text-neutral-700">
          {analysis.usableCycles} von {analysis.needed} Zyklen mit genug
          Einträgen. Trage deinen Check-in und den Beginn deiner Periode ein,
          dann kann Bloom nach Mustern suchen.
        </p>
        <progress
          max={analysis.needed}
          value={Math.min(analysis.usableCycles, analysis.needed)}
          aria-label="Zyklen mit genug Einträgen"
          className="h-2 w-full"
        />
      </section>
    );
  }
  if (analysis.status === "no_pattern") {
    return (
      <section className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Kein klares Muster</h2>
        <p className="text-neutral-700">
          In {analysis.usableCycles} Zyklen hat Bloom {analysis.tested}{" "}
          Vergleiche gemacht und keinen deutlichen, wiederkehrenden Unterschied
          rund um deine Periode gefunden. Das ist ein normales Ergebnis: Bei
          manchen Frauen ist der Einfluss klein oder wechselt von Zyklus zu
          Zyklus. Bloom orientiert sich deshalb weiter an deinem Tag, nicht an
          deinem Zyklus.
        </p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <p className="text-neutral-700">
        Aus {analysis.usableCycles} Zyklen hat Bloom {analysis.findings.length}{" "}
        Muster in deinen Daten gefunden. Tippe auf „Zyklen im Detail“, um die
        Zahlen zu sehen.
      </p>
      {analysis.findings.map((f) => (
        <Finding key={`${f.metric}:${f.window}`} finding={f} />
      ))}
    </section>
  );
}

function Finding({ finding }: { finding: PatternFinding }) {
  const t = describeFinding(finding);
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <h2 className="text-lg font-semibold">{t.title}</h2>
      <p className="text-sm text-neutral-800">{t.summary}</p>
      <details className="text-sm">
        <summary className="cursor-pointer underline">Zyklen im Detail</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left">
            <caption className="pb-1 text-left text-xs text-neutral-600">
              Durchschnitt pro Zyklus ({t.unit})
            </caption>
            <thead>
              <tr className="border-b border-neutral-300">
                <th className="py-1 pr-2">Zyklus ab</th>
                <th className="px-2">In diesen Tagen</th>
                <th className="px-2">Übrige Tage</th>
              </tr>
            </thead>
            <tbody>
              {finding.breakdown.map((b) => (
                <tr key={b.start} className="border-b border-neutral-200">
                  <th scope="row" className="py-1 pr-2 font-normal">
                    {fmtDay(b.start)}
                  </th>
                  <td className="px-2">{t.value(b.windowAvg)}</td>
                  <td className="px-2">{t.value(b.restAvg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
