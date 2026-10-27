// Pins down the waitlist flow with fakes: only hashes are stored, the form never reveals whether an address exists, resends are rate-limited, expired tokens are refused.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmSignup, signup } from "./service";
import type { Mailer, WaitlistEntry, WaitlistRepo } from "./types";

function memoryRepo() {
  const rows: WaitlistEntry[] = [];
  const repo: WaitlistRepo = {
    async findByEmail(email) {
      return rows.find((r) => r.email === email) ?? null;
    },
    async findByTokenHash(hash) {
      return rows.find((r) => r.tokenHash === hash) ?? null;
    },
    async insert(entry) {
      rows.push(entry);
    },
    async update(email, patch) {
      const row = rows.find((r) => r.email === email);
      if (row) Object.assign(row, patch);
    },
  };
  return { rows, repo };
}

describe("waitlist service", () => {
  let now: Date;
  let mailer: Mailer;
  let mem: ReturnType<typeof memoryRepo>;
  const input = {
    email: "a@b.de",
    consent: "on",
    variant: "c",
    source: "flyer",
  };
  const deps = () => ({ repo: mem.repo, mailer, now: () => now });

  beforeEach(() => {
    now = new Date("2026-11-01T10:00:00Z");
    mailer = { sendConfirmation: vi.fn(async () => {}) };
    mem = memoryRepo();
  });

  it("stores unconfirmed entry (hash only) and sends confirmation", async () => {
    const r = await signup(input, deps());
    expect(r).toEqual({ ok: true });
    expect(mem.rows).toHaveLength(1);
    expect(mem.rows[0].confirmedAt).toBeNull();
    expect(mem.rows[0].variant).toBe("c");
    expect(mem.rows[0].consentAt).toEqual(now);
    const [email, token] = (mailer.sendConfirmation as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(email).toBe("a@b.de");
    expect(mem.rows[0].tokenHash).not.toBe(token);
  });

  it("returns invalid for bad input without side effects", async () => {
    const r = await signup({ ...input, email: "x" }, deps());
    expect(r).toEqual({ ok: false, error: "invalid" });
    expect(mem.rows).toHaveLength(0);
    expect(mailer.sendConfirmation).not.toHaveBeenCalled();
  });

  it("silently succeeds on honeypot without storing", async () => {
    const r = await signup({ ...input, website: "x" }, deps());
    expect(r).toEqual({ ok: true });
    expect(mem.rows).toHaveLength(0);
    expect(mailer.sendConfirmation).not.toHaveBeenCalled();
  });

  it("does not leak or re-mail already confirmed addresses", async () => {
    await signup(input, deps());
    mem.rows[0].confirmedAt = now;
    const r = await signup(input, deps());
    expect(r).toEqual({ ok: true });
    expect(mailer.sendConfirmation).toHaveBeenCalledTimes(1);
  });

  it("rate-limits resends within 10 minutes, allows later", async () => {
    await signup(input, deps());
    now = new Date(now.getTime() + 5 * 60_000);
    await signup(input, deps());
    expect(mailer.sendConfirmation).toHaveBeenCalledTimes(1);
    now = new Date(now.getTime() + 6 * 60_000);
    await signup(input, deps());
    expect(mailer.sendConfirmation).toHaveBeenCalledTimes(2);
    expect(mem.rows).toHaveLength(1);
  });

  it("confirms with a valid token", async () => {
    await signup(input, deps());
    const token = (mailer.sendConfirmation as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    now = new Date(now.getTime() + 60_000);
    expect(await confirmSignup(token, deps())).toEqual({ ok: true });
    expect(mem.rows[0].confirmedAt).toEqual(now);
  });

  it("rejects unknown and expired tokens", async () => {
    expect(
      await confirmSignup("unknown-token-value-unknown-token-value", deps()),
    ).toEqual({
      ok: false,
      error: "invalid",
    });
    await signup(input, deps());
    const token = (mailer.sendConfirmation as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    now = new Date(now.getTime() + 8 * 24 * 3600_000);
    expect(await confirmSignup(token, deps())).toEqual({
      ok: false,
      error: "expired",
    });
  });
});
