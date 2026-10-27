"use client";

// Logout control in the app layout. Wipes the local database before the server logout runs.
// Reads the count of unsynced changes from the local outbox; the real logout is the action prop (server).
// Neighbours: lib/local/wipe, local-provider.tsx.

import { useRef } from "react";
import { unsyncedChanges, wipeLocalData } from "@/lib/local/wipe";

// Logging out removes the local data and cached pages, so the next person on a
// shared device can't open them. Unsynced changes would be lost, so ask first.
export function LogoutForm({ action }: { action: () => Promise<void> }) {
  // Set after the wipe so the re-submit below passes straight through this handler instead of looping.
  const confirmed = useRef(false);
  return (
    <form
      action={action}
      className="ml-auto"
      onSubmit={async (e) => {
        if (confirmed.current) return;
        e.preventDefault();
        const form = e.currentTarget;
        const pending = await unsyncedChanges().catch(() => 0);
        if (
          pending > 0 &&
          !confirm(
            `${pending} Änderung${pending === 1 ? " ist" : "en sind"} noch nicht gesichert und gehen beim Ausloggen verloren. Trotzdem ausloggen?`,
          )
        ) {
          return;
        }
        await wipeLocalData().catch(() => {});
        confirmed.current = true;
        form.requestSubmit();
      }}
    >
      <button className="underline">Ausloggen</button>
    </form>
  );
}
