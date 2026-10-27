"use client";

// Root client provider of the logged-in app (mounted in app/(app)/layout.tsx).
// Owns the per-user local database (Dexie/IndexedDB), the online flag and the background sync loop, and
// exposes them with the profile flags (units, cycleMode, hideWeight, nutritionMode) through useLocal().
// Everything else reads and writes the local database first; the server is only a sync target (lib/sync).

import { useLiveQuery } from "dexie-react-hooks";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createLocalDb, type LocalDb } from "@/lib/local/db";
import { wipeNutrition } from "@/lib/local/nutrition";
import { clearPageCache } from "@/lib/local/wipe";
import { requeueRejected, syncWithLock } from "@/lib/sync/client";
import type { Units } from "@/lib/workout/units";

// Nutrition is opt-in: "off" stores and shows nothing, "log_no_totals" logs entries but never shows sums.
export type NutritionMode = "off" | "log" | "log_no_totals";

// How she wants her cycle handled; null until chosen in onboarding. Only natural/irregular show cycle features.
export type CycleMode = "natural" | "hormonal" | "irregular" | "none" | null;

export type SyncStatus = "idle" | "syncing" | "ok" | "error" | "unauthorized";

// What useLocal() returns. db is null on the server and during hydration, so consumers must handle null.
interface LocalContextValue {
  db: LocalDb | null;
  userId: string;
  units: Units;
  cycleMode: CycleMode;
  hideWeight: boolean;
  nutritionMode: NutritionMode;
  status: SyncStatus;
  pending: number;
  online: boolean;
  syncNow: () => void;
}

const LocalContext = createContext<LocalContextValue | null>(null);

export function useLocal(): LocalContextValue {
  const ctx = useContext(LocalContext);
  if (!ctx) throw new Error("useLocal must be used inside LocalProvider");
  return ctx;
}

// Fallback polling interval; the real triggers are coming online, returning to the tab and local changes (see below).
const SYNC_INTERVAL_MS = 60_000;

// One cached database per user, so a shared device never mixes accounts and
// the instance stays stable across renders.
const databases = new Map<string, LocalDb>();
function getDb(userId: string): LocalDb | null {
  if (typeof indexedDB === "undefined") return null;
  let db = databases.get(userId);
  if (!db) {
    db = createLocalDb(`bloom-${userId}`);
    databases.set(userId, db);
  }
  return db;
}
const noopSubscribe = () => () => {};

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

// `enabled` is false until onboarding is finished: the local database works, but nothing is synced yet.
export function LocalProvider({
  userId,
  units,
  cycleMode,
  hideWeight,
  nutritionMode,
  enabled,
  children,
}: {
  userId: string;
  units: Units;
  cycleMode: CycleMode;
  hideWeight: boolean;
  nutritionMode: NutritionMode;
  enabled: boolean;
  children: ReactNode;
}) {
  // Server snapshot is null, so hydration matches; the client picks up the database right after.
  const db = useSyncExternalStore(
    noopSubscribe,
    () => getDb(userId),
    () => null,
  );
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [status, setStatus] = useState<SyncStatus>("idle");
  const running = useRef(false);

  const pending = useLiveQuery(() => (db ? db.outbox.count() : 0), [db]) ?? 0;

  // The ref guards against overlapping syncs (state would be stale inside the timers); status is for the UI only.
  const syncNow = useCallback(() => {
    if (!db || !enabled || running.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    running.current = true;
    setStatus("syncing");
    syncWithLock(db)
      .then((r) => {
        setStatus(r.status === "ok" ? "ok" : r.status);
        // Session ended: don't keep personalised pages around.
        if (r.status === "unauthorized") void clearPageCache();
        // Consent withdrawn: nutrition data does not stay on this device.
        if (nutritionMode === "off") void wipeNutrition(db).catch(() => {});
      })
      .finally(() => {
        running.current = false;
      });
  }, [db, enabled, nutritionMode]);

  // Sync triggers: coming back online, returning to the tab, shortly after start (also retries previously rejected items), and every minute as a fallback.
  useEffect(() => {
    const up = () => syncNow();
    const visible = () => document.visibilityState === "visible" && syncNow();
    window.addEventListener("online", up);
    document.addEventListener("visibilitychange", visible);
    const first = setTimeout(() => {
      if (db) void requeueRejected(db).catch(() => {});
      syncNow();
    }, 0);
    const timer = setInterval(syncNow, SYNC_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", up);
      document.removeEventListener("visibilitychange", visible);
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [syncNow, db]);

  // Push soon after local changes instead of waiting for the interval.
  useEffect(() => {
    if (pending === 0) return;
    const t = setTimeout(syncNow, 2000);
    return () => clearTimeout(t);
  }, [pending, syncNow]);

  // Offline support: service worker + ask the browser not to evict our data.
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // Let the worker fetch the offline pages and the scripts they need.
        registration.active?.postMessage({
          type: "warm",
          paths: [
            "/app",
            "/training",
            "/training/session",
            "/verlauf",
            "/zyklus",
            "/muster",
            "/ernaehrung",
          ],
        });
      })
      .catch(() => {});
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      db,
      userId,
      units,
      cycleMode,
      hideWeight,
      nutritionMode,
      status,
      pending,
      online,
      syncNow,
    }),
    [
      db,
      userId,
      units,
      cycleMode,
      hideWeight,
      nutritionMode,
      status,
      pending,
      online,
      syncNow,
    ],
  );
  return <LocalContext value={value}>{children}</LocalContext>;
}
