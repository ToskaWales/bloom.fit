// Deterministic ids for rows that several offline devices (or a re-import) must
// create independently and still end up as ONE row. Random ids (crypto.randomUUID)
// are used everywhere else and do NOT live here.
// Used by src/lib/local/daily.ts, src/lib/local/suggestions.ts and src/lib/import/build.ts.
// Stable ids derived from a key (SHA-256 -> RFC 4122 v5-style uuid). Used where
// several offline devices must converge on the same row (one check-in per day,
// re-imports) instead of creating duplicates.
export async function deterministicUuid(key: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)),
  );
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50; // version 5 layout
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Id of the one row for (user, kind, day), e.g. "the check-in of 2026-11-03".
// Ids are global in the database, so they are always scoped to the user: without
// the userId two people would compute the same id for the same day, and one
// could collide with (or probe for) the other's row.
export const dailyId = (userId: string, kind: string, day: string) =>
  deterministicUuid(`${userId}|daily|${kind}|${day}`);
