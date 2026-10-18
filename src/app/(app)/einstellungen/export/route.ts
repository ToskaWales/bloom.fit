import { createClient } from "@/lib/supabase/server";

// Data export (GDPR Art. 20): everything stored about the signed-in user, read
// through RLS so it can only ever contain their own rows.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new Response("Unauthorized", { status: 401 });

  const uid = data.user.id;
  const rows = (table: string) =>
    supabase
      .from(table)
      .select("*")
      .eq("user_id", uid)
      .is("deleted_at", null)
      .order("created_at")
      .limit(100_000);
  const [
    profile,
    consents,
    customExercises,
    workouts,
    workoutExercises,
    workoutSets,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).single(),
    supabase
      .from("consents")
      .select("*")
      .eq("user_id", uid)
      .order("granted_at"),
    rows("custom_exercises"),
    rows("workouts"),
    rows("workout_exercises"),
    rows("workout_sets"),
  ]);
  const failed = [
    profile,
    consents,
    customExercises,
    workouts,
    workoutExercises,
    workoutSets,
  ].some((r) => r.error);
  if (failed) return new Response("Export failed", { status: 500 });

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      email: data.user.email,
      profile: profile.data,
      consents: consents.data,
      training: {
        custom_exercises: customExercises.data,
        workouts: workouts.data,
        workout_exercises: workoutExercises.data,
        workout_sets: workoutSets.data,
      },
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
