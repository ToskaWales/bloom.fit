import { createToken, hashToken } from "./token";
import type { Deps } from "./types";
import { parseSignup } from "./validate";

const RESEND_COOLDOWN_MS = 10 * 60_000;
const TOKEN_TTL_MS = 7 * 24 * 3600_000;

export type SignupResult = { ok: true } | { ok: false; error: "invalid" };
export type ConfirmResult =
  { ok: true } | { ok: false; error: "invalid" | "expired" };

// Always returns ok for well-formed input so the form can't be used to probe
// which addresses are on the list.
export async function signup(
  input: Record<string, unknown>,
  deps: Deps,
): Promise<SignupResult> {
  const parsed = parseSignup(input);
  if (!parsed.ok) return { ok: false, error: "invalid" };
  const { email, variant, source, honeypot } = parsed.data;
  if (honeypot) return { ok: true };

  const now = deps.now();
  const existing = await deps.repo.findByEmail(email);

  if (existing?.confirmedAt) return { ok: true };

  if (existing) {
    if (now.getTime() - existing.tokenSentAt.getTime() < RESEND_COOLDOWN_MS)
      return { ok: true };
    const { token, hash } = createToken();
    await deps.repo.update(email, { tokenHash: hash, tokenSentAt: now });
    await deps.mailer.sendConfirmation(email, token);
    return { ok: true };
  }

  const { token, hash } = createToken();
  await deps.repo.insert({
    email,
    variant,
    source,
    tokenHash: hash,
    tokenSentAt: now,
    consentAt: now,
    confirmedAt: null,
  });
  await deps.mailer.sendConfirmation(email, token);
  return { ok: true };
}

export async function confirmSignup(
  token: string,
  deps: Deps,
): Promise<ConfirmResult> {
  const entry = await deps.repo.findByTokenHash(hashToken(token));
  if (!entry) return { ok: false, error: "invalid" };
  const now = deps.now();
  if (entry.confirmedAt) return { ok: true };
  if (now.getTime() - entry.tokenSentAt.getTime() > TOKEN_TTL_MS) {
    return { ok: false, error: "expired" };
  }
  await deps.repo.update(entry.email, { confirmedAt: now });
  return { ok: true };
}
