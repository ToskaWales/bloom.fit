import { createResendMailer } from "./resend-mailer";
import { createSupabaseRepo } from "./supabase-repo";
import type { Deps } from "./types";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export function getDeps(): Deps {
  return {
    repo: createSupabaseRepo(
      required("SUPABASE_URL"),
      required("SUPABASE_SERVICE_ROLE_KEY"),
    ),
    mailer: createResendMailer(
      required("RESEND_API_KEY"),
      required("MAIL_FROM"),
      required("NEXT_PUBLIC_SITE_URL"),
    ),
    now: () => new Date(),
  };
}
