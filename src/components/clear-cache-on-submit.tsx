"use client";

import type { ReactNode } from "react";
import { clearPageCache } from "@/lib/local/wipe";

// Cached page shells carry profile flags (cycle mode, hidden weight). After a
// settings form is submitted, drop them so an offline start can't use old flags.
export function ClearCacheOnSubmit({ children }: { children: ReactNode }) {
  return (
    <div onSubmit={() => void clearPageCache().catch(() => {})}>{children}</div>
  );
}
