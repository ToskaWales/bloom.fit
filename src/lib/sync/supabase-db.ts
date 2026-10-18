import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncDb } from "./server";
import type { WireRow } from "./tables";

// Runs as the signed-in user, so RLS (owner + invited access) is the final
// authority; user_id is set from the session, never from the request body.
export function supabaseSyncDb(supabase: SupabaseClient): SyncDb {
  return {
    async upsert(table, userId, rows) {
      const { error } = await supabase.from(table).upsert(
        rows.map((r) => ({ ...r, user_id: userId })),
        { onConflict: "id" },
      );
      if (error) throw new Error(`upsert ${table}: ${error.message}`);
    },
    async pull(table, userId, cursor, limit) {
      let query = supabase.from(table).select("*").eq("user_id", userId);
      if (cursor) query = query.gte("updated_at", cursor);
      const { data, error } = await query
        .order("updated_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`pull ${table}: ${error.message}`);
      return (data ?? []) as WireRow[];
    },
  };
}
