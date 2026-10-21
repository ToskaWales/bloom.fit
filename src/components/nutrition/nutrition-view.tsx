"use client";

import Link from "next/link";
import { useState } from "react";
import { useToday } from "@/components/daily/use-today";
import { useLocal } from "@/components/local-provider";
import { EntryList } from "@/components/nutrition/entry-list";
import { FoodsList } from "@/components/nutrition/foods-list";
import { QuickAddForm } from "@/components/nutrition/quick-add-form";
import { useDayLogs, useRecent } from "@/components/nutrition/use-nutrition";
import { SyncStatus } from "@/components/training/sync-status";
import { secondaryButtonClass } from "@/components/ui";
import { copyEntryTo } from "@/lib/local/nutrition";
import { dayTotals } from "@/lib/nutrition/calc";
import { NUTRITION_TEXT, totalsLine } from "@/lib/nutrition/texts";

export function NutritionView() {
  const { db, nutritionMode } = useLocal();
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? today;
  const logs = useDayLogs(day);
  const recent = useRecent(day);

  if (nutritionMode === "off") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-8">
        <h1 className="text-2xl font-bold">{NUTRITION_TEXT.title}</h1>
        <p className="text-neutral-700">
          Ernährung ist ausgeschaltet. Du kannst sie in den Einstellungen
          einschalten, wenn du möchtest.
        </p>
        <Link href="/einstellungen" className="underline">
          {NUTRITION_TEXT.settingsLink}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{NUTRITION_TEXT.title}</h1>
        <SyncStatus />
      </div>
      <p className="text-neutral-700">{NUTRITION_TEXT.intro}</p>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Tag
        <input
          type="date"
          value={day}
          max={today}
          onChange={(e) => setPicked(e.target.value || null)}
          className="w-fit rounded-xl border border-neutral-300 bg-white px-3 py-2"
        />
      </label>

      {logs === undefined ? (
        <p className="text-neutral-600">Lädt …</p>
      ) : (
        <>
          {nutritionMode === "log" ? (
            <p className="text-sm text-neutral-700">
              {totalsLine(dayTotals(logs))}
            </p>
          ) : (
            <p className="text-sm text-neutral-600">
              {NUTRITION_TEXT.totalsHidden}
            </p>
          )}
          <EntryList logs={logs} />
        </>
      )}

      {day && <QuickAddForm day={day} />}

      {recent && recent.length > 0 && (
        <section aria-labelledby="recent-title" className="flex flex-col gap-2">
          <h2 id="recent-title" className="text-lg font-semibold">
            {NUTRITION_TEXT.recentTitle}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() =>
                    db &&
                    void copyEntryTo(db, r.id, { day, meal: r.meal }).catch(
                      () => {},
                    )
                  }
                  className={secondaryButtonClass}
                >
                  {r.name_snapshot || "Eintrag"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {day && <FoodsList day={day} />}

      <p className="text-xs text-neutral-500">
        {NUTRITION_TEXT.offlineNote} {NUTRITION_TEXT.note}
      </p>
    </main>
  );
}
