import Dexie from "dexie";

const PREFIX = "bloom-";
const PAGE_CACHE_PREFIX = "pages-";

const bloomDatabases = async () =>
  (await Dexie.getDatabaseNames()).filter((n) => n.startsWith(PREFIX));

// Changes that exist only on this device (not yet confirmed by the server).
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
