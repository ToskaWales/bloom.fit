"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useLocal } from "@/components/local-provider";
import { ScaleInput } from "@/components/daily/scale-input";
import { addDays } from "@/lib/daily/day";
import { SYMPTOMS, SYMPTOM_LABELS, type Symptom } from "@/lib/daily/symptoms";
import { getCheckin, saveCheckin, type CheckinValues } from "@/lib/local/daily";

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

export function CheckinCard({ today }: { today: string }) {
  const { db, userId, cycleMode } = useLocal();
  const [offset, setOffset] = useState<0 | -1>(0);
  const day = addDays(today, offset);

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
  const update = (patch: Partial<CheckinValues>) => {
    if (db) void saveCheckin(db, userId, day, { ...value, ...patch });
  };
  const showCycleSymptoms = cycleMode !== "none";

  return (
    <section
      aria-labelledby="checkin-title"
      className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h2 id="checkin-title" className="text-lg font-semibold">
          {offset === 0 ? "Wie geht es dir heute?" : "Check-in für gestern"}
        </h2>
        <button
          className="text-sm underline"
          onClick={() => setOffset(offset === 0 ? -1 : 0)}
        >
          {offset === 0 ? "Gestern nachtragen" : "Zurück zu heute"}
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
                        update({
                          symptoms: on
                            ? value.symptoms.filter((x) => x !== s)
                            : [...value.symptoms, s],
                        })
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
              key={row?.updated_at}
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
