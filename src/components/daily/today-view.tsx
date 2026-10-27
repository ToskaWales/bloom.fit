"use client";

// Screen /app ("Heute"): the daily home that stacks check-in, suggestions, cycle, weight and nutrition cards.
// Only composes cards; each card reads the local database itself. Cards render only once today's date is known.
// Neighbours: use-today.ts, engine/suggestions-card.tsx, nutrition/nutrition-card.tsx.

import Link from "next/link";
import { CheckinCard } from "@/components/daily/checkin-card";
import { CycleCard } from "@/components/daily/cycle-card";
import { WeightCard } from "@/components/daily/weight-card";
import { NutritionCard } from "@/components/nutrition/nutrition-card";
import { SuggestionsCard } from "@/components/engine/suggestions-card";
import { SyncStatus } from "@/components/training/sync-status";
import { buttonClass } from "@/components/ui";
import { useToday } from "@/components/daily/use-today";

export function TodayView() {
  const today = useToday();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Heute</h1>
        <SyncStatus />
      </div>
      {/* useToday() is empty on the server and during hydration; cards wait for the real device date to avoid mismatches. */}
      {today && (
        <>
          <CheckinCard today={today} />
          <SuggestionsCard today={today} />
          <CycleCard today={today} />
          <WeightCard today={today} />
          <NutritionCard today={today} />
        </>
      )}
      <Link href="/training" className={`${buttonClass} text-center`}>
        Zum Training
      </Link>
    </main>
  );
}
