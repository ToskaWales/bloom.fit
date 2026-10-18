import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const PAGE = 1000; // PostgREST caps responses (1000 rows by default), so read in pages
const TRAINING_TABLES = [
  "custom_exercises",
  "workouts",
  "workout_exercises",
  "workout_sets",
  "templates",
  "template_exercises",
] as const;

async function fetchAll(
  supabase: SupabaseClient,
  table: string,
  userId: string,
) {
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

// Data export (GDPR Art. 15/20): everything stored about the signed-in user,
// including rows they deleted that haven't been purged yet. Read through RLS, so
// it can only ever contain their own rows.
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
