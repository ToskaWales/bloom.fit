"use client";

// Hook returning the device's calendar day as YYYY-MM-DD, shared by all daily screens.
// Hydration-safe: empty string on the server and during hydration, the real day afterwards. No data access.
// Neighbours: every view under daily/, engine/ and nutrition/.

import { useSyncExternalStore } from "react";
import { localDay } from "@/lib/daily/day";

// The device's calendar day. Empty on the server (and during hydration), so
// server and client markup match; updates when the app returns to the
// foreground, which also covers an app left open past midnight.
function subscribe(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  const timer = setInterval(callback, 60_000);
  return () => {
    document.removeEventListener("visibilitychange", callback);
    clearInterval(timer);
  };
}

// Callers must treat "" as 'not known yet' and skip date-based queries.
export function useToday(): string {
  return useSyncExternalStore(
    subscribe,
    () => localDay(),
    () => "",
  );
}
