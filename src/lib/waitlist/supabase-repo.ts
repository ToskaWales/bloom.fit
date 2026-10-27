// WaitlistRepo on the Supabase `waitlist` table using the service-role key (server only; the table has no public access). Maps snake_case columns to the camelCase WaitlistEntry.
import { createClient } from "@supabase/supabase-js";
import type { WaitlistEntry, WaitlistRepo } from "./types";

interface Row {
  email: string;
  variant: WaitlistEntry["variant"];
  source: string | null;
  token_hash: string;
  token_sent_at: string;
  consent_at: string;
  confirmed_at: string | null;
}

const toEntry = (r: Row): WaitlistEntry => ({
  email: r.email,
  variant: r.variant,
  source: r.source,
  tokenHash: r.token_hash,
  tokenSentAt: new Date(r.token_sent_at),
  consentAt: new Date(r.consent_at),
  confirmedAt: r.confirmed_at ? new Date(r.confirmed_at) : null,
});

const toRow = (p: Partial<WaitlistEntry>) => ({
  ...(p.email !== undefined && { email: p.email }),
  ...(p.variant !== undefined && { variant: p.variant }),
  ...(p.source !== undefined && { source: p.source }),
  ...(p.tokenHash !== undefined && { token_hash: p.tokenHash }),
  ...(p.tokenSentAt !== undefined && {
    token_sent_at: p.tokenSentAt.toISOString(),
  }),
  ...(p.consentAt !== undefined && { consent_at: p.consentAt.toISOString() }),
  ...(p.confirmedAt !== undefined && {
    confirmed_at: p.confirmedAt ? p.confirmedAt.toISOString() : null,
  }),
});

export function createSupabaseRepo(
  url: string,
  serviceRoleKey: string,
): WaitlistRepo {
  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const table = () => db.from("waitlist");

  return {
    async findByEmail(email) {
      const { data, error } = await table()
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      return data ? toEntry(data as Row) : null;
    },
    async findByTokenHash(hash) {
      const { data, error } = await table()
        .select("*")
        .eq("token_hash", hash)
        .maybeSingle();
      if (error) throw error;
      return data ? toEntry(data as Row) : null;
    },
    async insert(entry) {
      const { error } = await table().insert(toRow(entry));
      if (error) throw error;
    },
    async update(email, patch) {
      const { error } = await table().update(toRow(patch)).eq("email", email);
      if (error) throw error;
    },
  };
}
