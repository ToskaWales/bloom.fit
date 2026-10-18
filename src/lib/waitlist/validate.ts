import { z } from "zod";
import type { HookVariant } from "./types";

const VARIANTS: readonly HookVariant[] = ["a", "b", "c"];

const schema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  consent: z.string().min(1),
  variant: z.string().optional(),
  source: z.string().optional(),
  website: z.string().optional(),
});

export interface SignupData {
  email: string;
  variant: HookVariant;
  source: string | null;
  honeypot: boolean;
}

export type ParseResult = { ok: true; data: SignupData } | { ok: false };

export function parseSignup(input: Record<string, unknown>): ParseResult {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { email, variant, source, website } = parsed.data;
  return {
    ok: true,
    data: {
      email,
      variant: VARIANTS.includes(variant as HookVariant)
        ? (variant as HookVariant)
        : "a",
      source: source && source.length <= 64 ? source : null,
      honeypot: Boolean(website),
    },
  };
}
