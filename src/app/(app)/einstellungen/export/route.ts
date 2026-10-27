// GET /einstellungen/export: downloads all of the signed-in user's data as
// JSON (GDPR access and portability). Signed in only: the auth check comes
// first and the answer is not cached. It reads through the user's own session,
// so RLS makes it impossible to include anyone else's rows.
// Errors are logged as a message only, never with row contents.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Rows per request.
const PAGE = 1000; // PostgREST caps responses (1000 rows by default), so read in pages
// Every user-owned table to export. When you add a table with user data, add it
// here too, otherwise the export is incomplete.
const TRAINING_TABLES = [
  "custom_exercises",
  "workouts",
  "workout_exercises",
  "workout_sets",
  "templates",
  "template_exercises",
  "checkins",
  "bodyweight_entries",
  "cycle_events",
  "suggestions",
  "foods",
  "food_logs",
] as const;

async function fetchAll(
  supabase: SupabaseClient,
  table: string,
  userId: string,
) {
  // Stable ordering (created_at, then id) so pages never overlap or skip rows.
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("created_at")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

// True if any food row came from Open Food Facts (its licence requires attribution).
const foodsFromOff = (rows: unknown): boolean =>
  Array.isArray(rows) &&
  rows.some((r) => (r as { source?: string }).source === "off");

// Data export (GDPR Art. 15/20): everything stored about the signed-in user,
// including rows they deleted that haven't been purged yet. Read through RLS, so
// it can only ever contain their own rows. Soft-deleted rows (deleted_at set)
// are included on purpose: they are still stored, so the person is entitled to
// see them, and nothing is filtered out silently.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new Response("Unauthorized", { status: 401 });
  const uid = data.user.id;

  try {
    const [profile, consents, ...tables] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase
        .from("consents")
        .select("*")
        .eq("user_id", uid)
        .order("granted_at"),
      ...TRAINING_TABLES.map((t) => fetchAll(supabase, t, uid)),
    ]);
    if (profile.error || consents.error) throw new Error("export failed");

    const body = JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        email: data.user.email,
        account_created_at: data.user.created_at,
        sign_in_providers: data.user.app_metadata?.providers ?? [],
        profile: profile.data,
        consents: consents.data,
        // Products taken from Open Food Facts carry its licence (ODbL).
        ...(foodsFromOff(tables[TRAINING_TABLES.indexOf("foods")])
          ? {
              attribution:
                "Einige Lebensmittel stammen aus Open Food Facts (openfoodfacts.org), Datenbanklizenz ODbL 1.0.",
            }
          : {}),
        training: Object.fromEntries(
          TRAINING_TABLES.map((t, i) => [t, tables[i]]),
        ),
      },
      null,
      2,
    );
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bloom-export.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(
      "export failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return new Response("Export failed", { status: 500 });
  }
}
