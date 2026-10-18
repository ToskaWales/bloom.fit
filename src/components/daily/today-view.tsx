"use client";

import Link from "next/link";
import { CheckinCard } from "@/components/daily/checkin-card";
import { CycleCard } from "@/components/daily/cycle-card";
import { WeightCard } from "@/components/daily/weight-card";
import { SyncStatus } from "@/components/training/sync-status";
import { buttonClass } from "@/components/ui";
import { localDay } from "@/lib/daily/day";

export function TodayView() {
  // Rendered on the client only after hydration reads the device's calendar day.
  const today = localDay();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Heute</h1>
        <SyncStatus />
      </div>
      <CheckinCard today={today} />
      <CycleCard today={today} />
      <WeightCard today={today} />
      <Link href="/training" className={`${buttonClass} text-center`}>
        Zum Training
      </Link>
    </main>
  );
}
