"use client";

// Wrapper used in the settings page (/einstellungen) around forms that change profile flags.
// It reads no data and makes no server call itself; it only clears the service worker's page cache on submit.
// Neighbours: lib/local/wipe (clearPageCache), hide-weight-form.tsx (does the same inline).

import type { ReactNode } from "react";
import { clearPageCache } from "@/lib/local/wipe";

// Cached page shells carry profile flags (cycle mode, hidden weight). After a
// settings form is submitted, drop them so an offline start can't use old flags.
export function ClearCacheOnSubmit({ children }: { children: ReactNode }) {
  return (
    <div onSubmit={() => void clearPageCache().catch(() => {})}>{children}</div>
  );
}
