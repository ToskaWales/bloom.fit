"use client";

import Link from "next/link";
import { useLocal } from "@/components/local-provider";
import { useDayLogs } from "@/components/nutrition/use-nutrition";
import { dayTotals } from "@/lib/nutrition/calc";
import { NUTRITION_TEXT, totalsLine } from "@/lib/nutrition/texts";

// Only shown when she turned nutrition on. One quiet line, no goal, no colour.
export function NutritionCard({ today }: { today: string }) {
  const { nutritionMode } = useLocal();
  const logs = useDayLogs(nutritionMode === "off" ? "" : today);
  if (nutritionMode === "off") return null;
  return (
    <section
      aria-labelledby="nutrition-card-title"
      className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <h2 id="nutrition-card-title" className="text-lg font-semibold">
        {NUTRITION_TEXT.title}
      </h2>
      {nutritionMode === "log" && logs && (
        <p className="text-sm text-neutral-700">
          {totalsLine(dayTotals(logs))}
        </p>
      )}
      <Link href="/ernaehrung" className="text-sm underline">
        Essen eintragen
      </Link>
    </section>
  );
}
