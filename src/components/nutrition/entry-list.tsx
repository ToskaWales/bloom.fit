"use client";

import { useLocal } from "@/components/local-provider";
import { deleteEntry } from "@/lib/local/nutrition";
import type { FoodLogRow, Meal } from "@/lib/local/types";
import { entryLine, MEAL_LABEL, NUTRITION_TEXT } from "@/lib/nutrition/texts";

const ORDER: (Meal | null)[] = ["morning", "midday", "evening", "snack", null];

export function EntryList({ logs }: { logs: FoodLogRow[] }) {
  const { db } = useLocal();
  if (logs.length === 0)
    return <p className="text-neutral-700">{NUTRITION_TEXT.empty}</p>;
  return (
    <div className="flex flex-col gap-3">
      {ORDER.map((meal) => {
        const items = logs.filter((l) => l.meal === meal);
        if (items.length === 0) return null;
        return (
          <section
            key={meal ?? "none"}
            aria-label={meal ? MEAL_LABEL[meal] : "Ohne Mahlzeit"}
          >
            {meal && (
              <h3 className="mb-1 text-sm font-semibold text-neutral-700">
                {MEAL_LABEL[meal]}
              </h3>
            )}
            <ul className="flex flex-col gap-2">
              {items.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-sm"
                >
                  <span>
                    <span className="font-medium">
                      {l.name_snapshot || "Eintrag"}
                    </span>
                    <span className="block text-neutral-600">
                      {entryLine(l)}
                    </span>
                  </span>
                  <button
                    onClick={() =>
                      db && void deleteEntry(db, l.id).catch(() => {})
                    }
                    aria-label={`${l.name_snapshot || "Eintrag"} löschen`}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5"
                  >
                    Löschen
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
