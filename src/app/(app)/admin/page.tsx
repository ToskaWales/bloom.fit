import { InviteForm } from "@/components/invite-form";
import { Page } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Einladungen – Bloom",
  robots: { index: false },
};

async function loadInviteData() {
  const db = createAdminClient();
  const [{ data: waitlist }, { data: invites }] = await Promise.all([
    db
      .from("waitlist")
      .select("email, variant, source, confirmed_at")
      .not("confirmed_at", "is", null)
      .order("confirmed_at"),
    db.from("invites").select("email, redeemed_at, expires_at"),
  ]);
  // Expired, unredeemed invites don't count: those people can be invited again.
  const now = Date.now();
  const invited = new Set(
    (invites ?? [])
      .filter((i) => i.redeemed_at || new Date(i.expires_at).getTime() > now)
      .map((i) => i.email),
  );
  return {
    total: waitlist?.length ?? 0,
    open: (waitlist ?? []).filter((w) => !invited.has(w.email)),
    sent: invites?.length ?? 0,
    redeemed: (invites ?? []).filter((i) => i.redeemed_at).length,
  };
}

export default async function AdminPage() {
  await requireAdmin();
  const { total, open, sent, redeemed } = await loadInviteData();

  return (
    <Page title="Einladungen" narrow={false}>
      <p className="text-sm text-neutral-600">
        {total} bestätigte Wartelisten-Einträge · {sent} Einladungen verschickt
        · {redeemed} eingelöst
      </p>
      <InviteForm waitlist={open} />
    </Page>
  );
}
