// Removes everything Bloom keeps on this device (local databases and cached pages)
// and counts changes that would be lost by doing so. Called on logout and account
// deletion. The database prefix must match the names used in
// src/components/local-provider.tsx ("bloom-<userId>"), the cache prefix the
// page cache of public/sw.js.
import Dexie from "dexie";

// Local databases are named "bloom-<something>" (see createLocalDb in db.ts).
const PREFIX = "bloom-";
// Matches the page cache "pages-<VERSION>" of the service worker (public/sw.js).
const PAGE_CACHE_PREFIX = "pages-";

const bloomDatabases = async () =>
  (await Dexie.getDatabaseNames()).filter((n) => n.startsWith(PREFIX));

// Changes that exist only on this device (not yet confirmed by the server), i.e.
// the outbox size over all local databases. Lets the UI warn before a logout
// would throw them away.
export async function unsyncedChanges(): Promise<number> {
  let total = 0;
  for (const name of await bloomDatabases()) {
    const db = new Dexie(name);
    try {
      await db.open();
      if (db.tables.some((t) => t.name === "outbox"))
        total += await db.table("outbox").count();
    } finally {
      db.close();
    }
  }
  return total;
}

// Drops the service worker's cached pages (they embed the signed-in user's data).
export async function clearPageCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  for (const key of await caches.keys())
    if (key.startsWith(PAGE_CACHE_PREFIX)) await caches.delete(key);
}

// Removes everything Bloom stored on this device: cached pages (they contain
// the user id) and every local training database. Used on logout and account
// deletion so the next person on a shared device sees nothing.
export async function wipeLocalData(): Promise<void> {
  await clearPageCache();
  for (const name of await bloomDatabases()) await Dexie.delete(name);
}
