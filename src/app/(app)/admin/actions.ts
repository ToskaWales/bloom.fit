"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { generateInviteCode } from "@/lib/invites/code";
import { sendInviteMail } from "@/lib/invites/mailer";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteState = {
  results?: { email: string; ok: boolean }[];
  error?: string;
};

const INVITE_TTL_MS = 14 * 24 * 3600_000;

export async function sendInvites(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { user } = await requireAdmin();

  const raw = [
    ...formData.getAll("email").map(String),
    ...String(formData.get("emails") ?? "").split(/[\s,;]+/),
  ];
  const emails = [
    ...new Set(raw.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  ];
  const valid = emails.filter((e) => z.email().safeParse(e).success);
  if (valid.length === 0)
    return { error: "Keine gültigen E-Mail-Adressen angegeben." };
  if (valid.length > 50) return { error: "Maximal 50 Einladungen auf einmal." };

  const db = createAdminClient();
  const results: { email: string; ok: boolean }[] = [];
  for (const email of valid) {
    const { code, hash } = generateInviteCode();
    const { error } = await db.from("invites").insert({
      email,
      code_hash: hash,
      created_by: user.id,
      expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    });
    if (error) {
      results.push({ email, ok: false });
      continue;
    }
    try {
      await sendInviteMail(email, code);
      results.push({ email, ok: true });
    } catch (err) {
      console.error("invite mail failed", err);
      await db.from("invites").delete().eq("code_hash", hash);
      results.push({ email, ok: false });
    }
  }
  revalidatePath("/admin");
  return { results };
}
