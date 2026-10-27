"use client";

// Card on the Today screen to enter today's weight and see a smoothed trend. Renders nothing when weight is hidden.
// Reads and writes bodyweight entries in the local database; shown values follow the unit setting from useLocal.
// Neighbours: use-daily-data.ts (useWeights), lib/daily/weight (trend), hide-weight-form.tsx.

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useLocal } from "@/components/local-provider";
import { useWeights } from "@/components/daily/use-daily-data";
import { buttonClass, inputClass } from "@/components/ui";
import { daysBetween } from "@/lib/daily/day";
import { isValidWeightKg } from "@/lib/daily/validate";
import { weightTrend } from "@/lib/daily/weight";
import { getWeight, removeWeight, saveWeight } from "@/lib/local/daily";
import {
  formatWeight,
  parseWeightInput,
  weightLabel,
} from "@/lib/workout/units";

export function WeightCard({ today }: { today: string }) {
  const { db, userId, units, hideWeight } = useLocal();
  const weights = useWeights();
  const todays = useLiveQuery(
    async () =>
      db ? ((await getWeight(db, userId, today)) ?? null) : undefined,
    [db, userId, today],
  );
  const [error, setError] = useState<string | null>(null);

  if (hideWeight) return null;
  // A trend needs a few weigh-ins and a recent one; otherwise it would present old data as current.
  const points = weights ? weightTrend(weights) : [];
  const last = points.at(-1);
  const trend =
    last && points.length >= 3 && daysBetween(last.day, today) <= 14
      ? last
      : undefined;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db) return;
    const form = e.currentTarget;
    const kg = parseWeightInput(
      String(new FormData(form).get("weight") ?? ""),
      units,
    );
    if (kg == null || !isValidWeightKg(kg)) {
      setError("Bitte gib ein plausibles Gewicht ein.");
      return;
    }
    setError(null);
    await saveWeight(db, userId, today, kg);
  }

  return (
    <section
      aria-labelledby="weight-title"
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <h2 id="weight-title" className="text-lg font-semibold">
        Gewicht
      </h2>
      <form onSubmit={submit} className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
          Heute ({weightLabel(units)})
          <input
            // The key remounts the uncontrolled input when the stored value changes (e.g. after sync), so it never shows a stale number.
            key={todays ? todays.weight_kg : "none"}
            name="weight"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={
              todays ? formatWeight(Number(todays.weight_kg), units) : ""
            }
            className={inputClass}
          />
        </label>
        <button className={`${buttonClass} shrink-0`}>Speichern</button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {trend ? (
        <p className="text-sm text-neutral-600">
          Trend der letzten Wochen: {formatWeight(trend.trend, units)}{" "}
          {weightLabel(units)}. Einzelne Tage schwanken stark, der Trend ist
          aussagekräftiger.
        </p>
      ) : (
        <p className="text-sm text-neutral-600">
          Trage dein Gewicht ein, wenn du magst. Nach ein paar Einträgen siehst
          du den Trend.
        </p>
      )}
      {todays && (
        <button
          className="w-fit text-xs text-neutral-500 underline"
          onClick={() => db && removeWeight(db, userId, today)}
        >
          Heutigen Eintrag entfernen
        </button>
      )}
    </section>
  );
}
