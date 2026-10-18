import { InviteForm } from "@/components/invite-form";
import { Page } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Einladungen – Bloom",
  robots: { index: false },
};

export default async function AdminPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: waitlist }, { data: invites }] = await Promise.all([
    db
      .from("waitlist")
      .select("email, variant, source, confirmed_at")
      .not("confirmed_at", "is", null)
      .order("confirmed_at"),
    db.from("invites").select("email, redeemed_at"),
  ]);
  const invited = new Set((invites ?? []).map((i) => i.email));
  const open = (waitlist ?? []).filter((w) => !invited.has(w.email));
  const redeemed = (invites ?? []).filter((i) => i.redeemed_at).length;

  return (
    <Page title="Einladungen" narrow={false}>
      <p className="text-sm text-neutral-600">
        {waitlist?.length ?? 0} bestätigte Wartelisten-Einträge ·{" "}
        {invites?.length ?? 0} Einladungen verschickt · {redeemed} eingelöst
      </p>
      <InviteForm waitlist={open} />
    </Page>
  );
}
