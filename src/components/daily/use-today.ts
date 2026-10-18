"use client";

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

export function useToday(): string {
  return useSyncExternalStore(
    subscribe,
    () => localDay(),
    () => "",
  );
}
