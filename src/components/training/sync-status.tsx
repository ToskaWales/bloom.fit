"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useLocal } from "@/components/local-provider";
import { REJECTED_KEY } from "@/lib/sync/client";

export function SyncStatus() {
  const { db, status, pending, online, syncNow } = useLocal();
  const rejected = useLiveQuery(async () => {
    if (!db) return 0;
    const raw = (await db.meta.get(REJECTED_KEY))?.value;
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  }, [db]);
  let text = "Alles gesichert";
  let tone = "text-emerald-700";
  if (!online) {
    text = pending
      ? `Offline · ${pending} Änderung${pending === 1 ? "" : "en"} warten`
      : "Offline";
    tone = "text-amber-700";
  } else if (status === "unauthorized") {
    text = "Bitte neu einloggen, um zu synchronisieren";
    tone = "text-red-700";
  } else if (status === "error") {
    text = pending ? `Sync-Fehler · ${pending} ausstehend` : "Sync-Fehler";
    tone = "text-red-700";
  } else if (rejected) {
    text = `${rejected} Eintrag${rejected === 1 ? "" : "e"} konnte${rejected === 1 ? "" : "n"} nicht gesichert werden`;
    tone = "text-red-700";
  } else if (pending > 0 || status === "syncing") {
    text = pending
      ? `Wird gesichert · ${pending} ausstehend`
      : "Wird gesichert …";
    tone = "text-neutral-600";
  }
  return (
    <button
      onClick={syncNow}
      className={`text-xs ${tone}`}
      aria-live="polite"
      title="Jetzt synchronisieren"
    >
      {text}
    </button>
  );
}
