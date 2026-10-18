"use client";

import Link from "next/link";
import { CheckinCard } from "@/components/daily/checkin-card";
import { CycleCard } from "@/components/daily/cycle-card";
import { WeightCard } from "@/components/daily/weight-card";
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
      {today && (
        <>
          <CheckinCard today={today} />
          <CycleCard today={today} />
          <WeightCard today={today} />
        </>
      )}
      <Link href="/training" className={`${buttonClass} text-center`}>
        Zum Training
      </Link>
    </main>
  );
}
