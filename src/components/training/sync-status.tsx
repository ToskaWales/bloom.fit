"use client";

import { useLocal } from "@/components/local-provider";

export function SyncStatus() {
  const { status, pending, online, syncNow } = useLocal();
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
