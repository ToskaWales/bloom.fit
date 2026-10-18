"use client";

import Link from "next/link";
import { useLocal } from "@/components/local-provider";
import { useCycleEvents } from "@/components/daily/use-daily-data";
import { secondaryButtonClass } from "@/components/ui";
import { summarizeCycle } from "@/lib/daily/cycle";
import { saveCycleEvent } from "@/lib/local/daily";

const fmt = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
  });

export function CycleCard({ today }: { today: string }) {
  const { db, userId, cycleMode } = useLocal();
  const events = useCycleEvents();
  if (cycleMode !== "natural" && cycleMode !== "irregular") return null;
  if (!events) return null;

  const s = summarizeCycle(events, today);
  let line: string;
  if (s.status === "no_data")
    line =
      "Trage den Beginn deiner letzten Periode ein, dann zeigt Bloom dir deinen Zyklustag.";
  else if (s.status === "stale")
    line =
      "Dein letzter eingetragener Periodenbeginn ist schon länger her. Trage den aktuellen ein, damit Bloom deinen Zyklustag zeigen kann.";
  else if (s.status === "overdue")
    line =
      "Deine Periode ist später als sonst. Das kann viele Gründe haben, zum Beispiel Stress, wenig Schlaf oder zu wenig Energie bei viel Training. Wenn sie länger ausbleibt, sprich bitte mit einer Ärztin oder einem Arzt.";
  else if (s.status === "not_enough_data")
    line = "Nach drei erfassten Zyklen schätzt Bloom deine nächste Periode.";
  else if (s.status === "irregular")
    line =
      "Dein Zyklus schwankt stark, deshalb gibt Bloom keine Vorhersage. Das Protokoll hilft dir trotzdem, Muster zu erkennen.";
  else
    line = `Nächste Periode voraussichtlich zwischen ${fmt(s.prediction!.earliest)} und ${fmt(s.prediction!.latest)} (Schätzung).`;
  // Within two weeks of the last start another "started" entry would only be a duplicate.
  const canLogStart = s.cycleDay === null || s.cycleDay > 14;

  return (
    <section
      aria-labelledby="cycle-title"
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <h2 id="cycle-title" className="text-lg font-semibold">
        {s.cycleDay ? `Zyklustag ${s.cycleDay}` : "Zyklus"}
      </h2>
      <p className="text-sm text-neutral-700">{line}</p>
      <div className="flex flex-wrap gap-2">
        {canLogStart && (
          <button
            className={secondaryButtonClass}
            onClick={() =>
              db && saveCycleEvent(db, userId, "period_start", today)
            }
          >
            Periode hat heute begonnen
          </button>
        )}
        <Link href="/zyklus" className="self-center text-sm underline">
          Zyklus-Protokoll
        </Link>
      </div>
      <p className="text-xs text-neutral-500">
        Nur eine Schätzung aus deinen eigenen Einträgen, keine Verhütungsmethode
        und keine Diagnose.
      </p>
    </section>
  );
}
