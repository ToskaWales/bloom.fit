// /training/session?id=...: the live workout screen. Signed in and onboarded.
// Data is read from the on-device database by the client component SessionView
// (writes go to the local outbox first and sync later via /api/sync).
import { Suspense } from "react";
import { SessionView } from "@/components/training/session-view";
import { requireOnboarded } from "@/lib/auth/dal";

export const metadata = { title: "Training – Bloom", robots: { index: false } };

// Client-rendered shell: the workout id comes from ?id= and the data from the
// local database, so one cached copy of this page serves every workout offline.
export default async function SessionPage() {
  await requireOnboarded();
  return (
    <Suspense fallback={<p className="p-8 text-neutral-600">Lädt …</p>}>
      <SessionView />
    </Suspense>
  );
}
