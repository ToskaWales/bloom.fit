import { createClient } from "@/lib/supabase/server";

// Data export (GDPR Art. 20): everything stored about the signed-in user, read
// through RLS so it can only ever contain their own rows.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new Response("Unauthorized", { status: 401 });

  const [profile, consents] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", data.user.id).single(),
    supabase
      .from("consents")
      .select("*")
      .eq("user_id", data.user.id)
      .order("granted_at"),
  ]);
  if (profile.error || consents.error)
    return new Response("Export failed", { status: 500 });

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      email: data.user.email,
      profile: profile.data,
      consents: consents.data,
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
}
