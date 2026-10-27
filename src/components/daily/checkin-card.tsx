"use client";

// Card on the Today screen: five 1-5 taps (sleep, energy, motivation, hunger) plus optional details.
// Reads and writes the local check-in for the chosen day (Dexie via lib/local/daily); no server calls, sync happens later.
// Neighbours: scale-input.tsx, today-view.tsx, engine/suggestions-card.tsx (the engine reads these values).

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useLocal } from "@/components/local-provider";
import { ScaleInput } from "@/components/daily/scale-input";
import { addDays } from "@/lib/daily/day";
import { SYMPTOMS, SYMPTOM_LABELS, type Symptom } from "@/lib/daily/symptoms";
import {
  getCheckin,
  patchCheckin,
  type CheckinValues,
} from "@/lib/local/daily";

// Shown for a day without a stored row; nothing is written until she taps something.
const EMPTY: CheckinValues = {
  sleepQuality: null,
  sleepHours: null,
  energy: null,
  motivation: null,
  hunger: null,
  symptoms: [],
  note: null,
};
const SLEEP_HOURS = Array.from({ length: 17 }, (_, i) => 4 + i * 0.5); // 4 – 12 h

// Offline-first: reads are live queries on the local database, writes land there immediately and sync later.
export function CheckinCard({ today }: { today: string }) {
  const { db, userId, cycleMode } = useLocal();
  // The chosen day is stored, not an offset: an app left open past midnight must not silently switch days.
  const [backfillDay, setBackfillDay] = useState<string | null>(null);
  const day = backfillDay ?? today;
  const isToday = backfillDay === null;

  // undefined = database still opening, null = no check-in yet for this day.
  const row = useLiveQuery(
    async () =>
      db ? ((await getCheckin(db, userId, day)) ?? null) : undefined,
    [db, userId, day],
  );
  const value: CheckinValues = row
    ? {
        sleepQuality: row.sleep_quality,
        sleepHours: row.sleep_hours,
        energy: row.energy,
        motivation: row.motivation,
        hunger: row.hunger,
        symptoms: row.symptoms as Symptom[],
        note: row.note,
      }
    : EMPTY;

  // Each tap is saved straight away (offline-first); there is no submit step.
  // The patch is applied to the stored value inside one transaction, so quick
  // consecutive taps (or a note blurring while a button is tapped) never overwrite each other.
  const update = (patch: Parameters<typeof patchCheckin>[3]) => {
    if (db) void patchCheckin(db, userId, day, patch);
  };
  // People who chose no cycle tracking never see cycle-related symptoms.
  const showCycleSymptoms = cycleMode !== "none";

  return (
    <section
      aria-labelledby="checkin-title"
      className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h2 id="checkin-title" className="text-lg font-semibold">
          {isToday ? "Wie geht es dir heute?" : "Check-in für gestern"}
        </h2>
        <button
          className="text-sm underline"
          onClick={() => setBackfillDay(isToday ? addDays(today, -1) : null)}
        >
          {isToday ? "Gestern nachtragen" : "Zurück zu heute"}
        </button>
      </div>

      <ScaleInput
        label="Schlaf"
        low="sehr schlecht"
        high="sehr gut"
        value={value.sleepQuality}
        onChange={(v) => update({ sleepQuality: v })}
      />
      <ScaleInput
        label="Energie"
        low="sehr niedrig"
        high="sehr hoch"
        value={value.energy}
        onChange={(v) => update({ energy: v })}
      />
      <ScaleInput
        label="Motivation"
        low="sehr niedrig"
        high="sehr hoch"
        value={value.motivation}
        onChange={(v) => update({ motivation: v })}
      />
      <ScaleInput
        label="Hunger"
        low="kaum Hunger"
        high="sehr großer Hunger"
        value={value.hunger}
        onChange={(v) => update({ hunger: v })}
      />

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">
          Mehr angeben (optional)
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3">
            Schlafdauer
            <select
              aria-label="Schlafdauer in Stunden"
              value={value.sleepHours ?? ""}
              onChange={(e) =>
                update({
                  sleepHours:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2"
            >
              <option value="">–</option>
              {SLEEP_HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).replace(".", ",")} h
                </option>
              ))}
            </select>
          </label>
          {showCycleSymptoms && (
            <fieldset>
              <legend className="mb-2 font-medium">Beschwerden</legend>
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map((s) => {
                  const on = value.symptoms.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        update((cur) => ({
                          symptoms: cur.symptoms.includes(s)
                            ? cur.symptoms.filter((x) => x !== s)
                            : [...cur.symptoms, s],
                        }))
                      }
                      className={`rounded-full border px-3 py-1.5 ${on ? "border-rose-600 bg-rose-50 text-rose-800" : "border-neutral-300 bg-white"}`}
                    >
                      {SYMPTOM_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <label className="flex flex-col gap-1">
            Notiz
            <textarea
              key={`${day}:${value.note ?? ""}`}
              defaultValue={value.note ?? ""}
              maxLength={1000}
              rows={2}
              onBlur={(e) => {
                const note = e.currentTarget.value.trim() || null;
                if (note !== value.note) update({ note });
              }}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </details>
      <p className="text-xs text-neutral-500" aria-live="polite">
        {row
          ? "Gespeichert"
          : "Wird automatisch gespeichert, sobald du etwas antippst."}
      </p>
    </section>
  );
}
