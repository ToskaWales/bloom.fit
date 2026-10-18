"use client";

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
import { clearPageCache } from "@/lib/local/wipe";
import { syncWithLock } from "@/lib/sync/client";
import type { Units } from "@/lib/workout/units";

export type SyncStatus = "idle" | "syncing" | "ok" | "error" | "unauthorized";

interface LocalContextValue {
  db: LocalDb | null;
  units: Units;
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

export function LocalProvider({
  userId,
  units,
  enabled,
  children,
}: {
  userId: string;
  units: Units;
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
      })
      .finally(() => {
        running.current = false;
      });
  }, [db, enabled]);

  useEffect(() => {
    const up = () => syncNow();
    const visible = () => document.visibilityState === "visible" && syncNow();
    window.addEventListener("online", up);
    document.addEventListener("visibilitychange", visible);
    const first = setTimeout(syncNow, 0);
    const timer = setInterval(syncNow, SYNC_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", up);
      document.removeEventListener("visibilitychange", visible);
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [syncNow]);

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
          paths: ["/training", "/training/session"],
        });
      })
      .catch(() => {});
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ db, units, status, pending, online, syncNow }),
    [db, units, status, pending, online, syncNow],
  );
  return <LocalContext value={value}>{children}</LocalContext>;
}
