import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { generateInviteCode } from "@/lib/invites/code";
import { asUser, createTestDb, createUser } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createTestDb();
});

const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);
const grantAccess = (id: string) =>
  q("update profiles set access_granted_at = now() where id = $1", [id]);

describe("profile creation and invite gate", () => {
  it("creates a pending profile for uninvited users", async () => {
    const id = await createUser(db, "x@example.com");
    const { rows } = await q(
      "select access_granted_at from profiles where id = $1",
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].access_granted_at).toBeNull();
  });

  it("grants access immediately when the email has an open invite", async () => {
    await q(
      "insert into invites (email, code_hash, expires_at) values ('a@example.com', 'h1', now() + interval '7 days')",
    );
    const id = await createUser(db, "A@Example.com");
    const { rows } = await q(
      "select access_granted_at from profiles where id = $1",
      [id],
    );
    expect(rows[0].access_granted_at).not.toBeNull();
    const inv = await q(
      "select redeemed_by from invites where code_hash = 'h1'",
    );
    expect(inv.rows[0].redeemed_by).toBe(id);
  });

  it("ignores expired invites", async () => {
    await q(
      "insert into invites (email, code_hash, expires_at) values ('a@example.com', 'h1', now() - interval '1 day')",
    );
    const id = await createUser(db, "a@example.com");
    const { rows } = await q(
      "select access_granted_at from profiles where id = $1",
      [id],
    );
    expect(rows[0].access_granted_at).toBeNull();
  });

  it("redeems a code once (Apple relay / different email case)", async () => {
    await q(
      "insert into invites (email, code_hash, expires_at) values ('other@example.com', encode(sha256(convert_to('secret-code', 'UTF8')), 'hex'), now() + interval '7 days')",
    );
    const id = await createUser(db, "relay@privaterelay.appleid.com");
    const first = await asUser(db, id, () =>
      q("select redeem_invite('secret-code') as ok"),
    );
    expect(first.rows[0].ok).toBe(true);
    const { rows } = await q(
      "select access_granted_at from profiles where id = $1",
      [id],
    );
    expect(rows[0].access_granted_at).not.toBeNull();

    const second = await createUser(db, "second@example.com");
    const again = await asUser(db, second, () =>
      q("select redeem_invite('secret-code') as ok"),
    );
    expect(again.rows[0].ok).toBe(false);
  });

  it("accepts codes hashed by the app (node and SQL hashes agree)", async () => {
    const { code, hash } = generateInviteCode();
    await q(
      "insert into invites (code_hash, expires_at) values ($1, now() + interval '7 days')",
      [hash],
    );
    const id = await createUser(db, "someone@example.com");
    const r = await asUser(db, id, () =>
      q("select redeem_invite($1) as ok", [code]),
    );
    expect(r.rows[0].ok).toBe(true);
  });

  it("rejects expired codes and anonymous callers", async () => {
    await q(
      "insert into invites (code_hash, expires_at) values (encode(sha256(convert_to('OLD-CODE', 'UTF8')), 'hex'), now() - interval '1 day')",
    );
    const id = await createUser(db, "z@example.com");
    const expired = await asUser(db, id, () =>
      q("select redeem_invite('OLD-CODE') as ok"),
    );
    expect(expired.rows[0].ok).toBe(false);
    const anon = await q("select redeem_invite('OLD-CODE') as ok");
    expect(anon.rows[0].ok).toBe(false);
  });

  it("rejects wrong codes", async () => {
    const id = await createUser(db, "z@example.com");
    const r = await asUser(db, id, () =>
      q("select redeem_invite('nope') as ok"),
    );
    expect(r.rows[0].ok).toBe(false);
  });
});

describe("row level security", () => {
  it("users only see and edit their own profile", async () => {
    const a = await createUser(db, "a@example.com");
    const b = await createUser(db, "b@example.com");
    const seen = await asUser(db, a, () => q("select id from profiles"));
    expect(seen.rows.map((r) => r.id)).toEqual([a]);
    const upd = await asUser(db, a, () =>
      q("update profiles set units = 'imperial' where id = $1 returning id", [
        b,
      ]),
    );
    expect(upd.rows).toHaveLength(0);
  });

  it("users cannot grant themselves access", async () => {
    const a = await createUser(db, "a@example.com");
    await expect(
      asUser(db, a, () =>
        q("update profiles set access_granted_at = now() where id = $1", [a]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("users cannot read invites", async () => {
    const a = await createUser(db, "a@example.com");
    await expect(
      asUser(db, a, () => q("select * from invites")),
    ).rejects.toThrow(/permission denied/);
  });

  it("consents are private, insert-only for the owner, revocable", async () => {
    const a = await createUser(db, "a@example.com");
    const b = await createUser(db, "b@example.com");
    await grantAccess(a);
    await grantAccess(b);
    await asUser(db, a, () =>
      q(
        "insert into consents (user_id, kind, version) values ($1, 'terms', '2026-11')",
        [a],
      ),
    );
    await expect(
      asUser(db, a, () =>
        q(
          "insert into consents (user_id, kind, version) values ($1, 'terms', '2026-11')",
          [b],
        ),
      ),
    ).rejects.toThrow();
    const bSees = await asUser(db, b, () => q("select * from consents"));
    expect(bSees.rows).toHaveLength(0);
    await asUser(db, a, () =>
      q(
        "update consents set revoked_at = now() where user_id = $1 and kind = 'terms'",
        [a],
      ),
    );
    await expect(
      asUser(db, a, () => q("delete from consents where user_id = $1", [a])),
    ).rejects.toThrow(/permission denied/);
  });

  it("allows only one active consent per kind", async () => {
    const a = await createUser(db, "a@example.com");
    await grantAccess(a);
    await asUser(db, a, () =>
      q(
        "insert into consents (user_id, kind, version) values ($1, 'terms', 'v1')",
        [a],
      ),
    );
    await expect(
      asUser(db, a, () =>
        q(
          "insert into consents (user_id, kind, version) values ($1, 'terms', 'v2')",
          [a],
        ),
      ),
    ).rejects.toThrow(/duplicate|unique/);
  });
});

describe("hardening", () => {
  it("uninvited users cannot write profile data or consents through the API", async () => {
    const a = await createUser(db, "a@example.com");
    const upd = await asUser(db, a, () =>
      q(
        "update profiles set cycle_mode = 'natural' where id = $1 returning id",
        [a],
      ),
    );
    expect(upd.rows).toHaveLength(0);
    await expect(
      asUser(db, a, () =>
        q(
          "insert into consents (user_id, kind, version) values ($1, 'terms', 'v1')",
          [a],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    // but they can still read their own pending profile (needed for /einladung)
    const seen = await asUser(db, a, () => q("select id from profiles"));
    expect(seen.rows).toHaveLength(1);
  });

  it("consent timestamps are server-controlled", async () => {
    const a = await createUser(db, "a@example.com");
    await grantAccess(a);
    await expect(
      asUser(db, a, () =>
        q(
          "insert into consents (user_id, kind, version, granted_at) values ($1, 'terms', 'v1', '2000-01-01')",
          [a],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, a, () =>
        q(
          "insert into consents (user_id, kind, version, revoked_at) values ($1, 'terms', 'v1', now())",
          [a],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("revocation is final, server-timestamped and cannot be undone", async () => {
    const a = await createUser(db, "a@example.com");
    await grantAccess(a);
    await asUser(db, a, () =>
      q(
        "insert into consents (user_id, kind, version) values ($1, 'product_mail', 'v1')",
        [a],
      ),
    );
    await asUser(db, a, () =>
      q(
        "update consents set revoked_at = '2000-01-01' where user_id = $1 and kind = 'product_mail'",
        [a],
      ),
    );
    const { rows } = await q(
      "select revoked_at > now() - interval '1 minute' as fresh from consents",
    );
    expect(rows[0].fresh).toBe(true);
    await expect(
      asUser(db, a, () =>
        q("update consents set revoked_at = null where user_id = $1", [a]),
      ),
    ).rejects.toThrow(/already revoked/);
  });

  it("revoking health-data consent ends onboarding", async () => {
    const a = await createUser(db, "a@example.com");
    await grantAccess(a);
    await q(
      `update profiles set goals = '{muscle}', training_days = 4, experience = '1to3y',
         cycle_mode = 'natural', basics_completed_at = now() where id = $1`,
      [a],
    );
    await asUser(db, a, () =>
      q(
        "insert into consents (user_id, kind, version) values ($1, 'terms', 'v1'), ($1, 'health_data', 'v1')",
        [a],
      ),
    );
    await asUser(db, a, () =>
      q("update profiles set onboarding_completed_at = now() where id = $1", [
        a,
      ]),
    );
    await asUser(db, a, () =>
      q(
        "update consents set revoked_at = now() where user_id = $1 and kind = 'health_data'",
        [a],
      ),
    );
    const { rows } = await q(
      "select onboarding_completed_at from profiles where id = $1",
      [a],
    );
    expect(rows[0].onboarding_completed_at).toBeNull();
  });

  it("does not burn a code for users who already have access", async () => {
    await q(
      "insert into invites (email, code_hash, expires_at) values ('a@example.com', 'hh', now() + interval '1 day')",
    );
    const a = await createUser(db, "a@example.com"); // auto-granted via email invite
    await q(
      "insert into invites (code_hash, expires_at) values (encode(sha256(convert_to('KEEP-ME-SAFE-1234', 'UTF8')), 'hex'), now() + interval '1 day')",
    );
    const r = await asUser(db, a, () =>
      q("select redeem_invite('KEEP-ME-SAFE-1234') as ok"),
    );
    expect(r.rows[0].ok).toBe(false);
    const inv = await q("select redeemed_at from invites where email is null");
    expect(inv.rows[0].redeemed_at).toBeNull();
  });

  it("only auto-grants access once the email is verified", async () => {
    await q(
      "insert into invites (email, code_hash, expires_at) values ('new@example.com', 'hx', now() + interval '1 day')",
    );
    const id = await createUser(db, "new@example.com", false);
    expect(
      (await q("select access_granted_at from profiles where id = $1", [id]))
        .rows[0].access_granted_at,
    ).toBeNull();
    await q("update auth.users set email_confirmed_at = now() where id = $1", [
      id,
    ]);
    expect(
      (await q("select access_granted_at from profiles where id = $1", [id]))
        .rows[0].access_granted_at,
    ).not.toBeNull();
    expect(
      (await q("select redeemed_by from invites where code_hash = 'hx'"))
        .rows[0].redeemed_by,
    ).toBe(id);
  });
});

describe("onboarding completion", () => {
  const fillProfile = (id: string) =>
    q(
      `update profiles set goals = '{muscle}', training_days = 4, experience = '1to3y',
         cycle_mode = 'natural', basics_completed_at = now() where id = $1`,
      [id],
    );

  it("requires active terms and health_data consent", async () => {
    const a = await createUser(db, "a@example.com");
    await grantAccess(a);
    await fillProfile(a);
    await expect(
      asUser(db, a, () =>
        q("update profiles set onboarding_completed_at = now() where id = $1", [
          a,
        ]),
      ),
    ).rejects.toThrow(/consent/i);
    await asUser(db, a, () =>
      q(
        "insert into consents (user_id, kind, version) values ($1, 'terms', 'v1'), ($1, 'health_data', 'v1')",
        [a],
      ),
    );
    const ok = await asUser(db, a, () =>
      q(
        "update profiles set onboarding_completed_at = now() where id = $1 returning id",
        [a],
      ),
    );
    expect(ok.rows).toHaveLength(1);
  });

  it("requires a complete profile (no skipping steps)", async () => {
    const a = await createUser(db, "a@example.com");
    await grantAccess(a);
    await asUser(db, a, () =>
      q(
        "insert into consents (user_id, kind, version) values ($1, 'terms', 'v1'), ($1, 'health_data', 'v1')",
        [a],
      ),
    );
    await expect(
      asUser(db, a, () =>
        q("update profiles set onboarding_completed_at = now() where id = $1", [
          a,
        ]),
      ),
    ).rejects.toThrow(/profile incomplete/);
  });

  it("validates goals and cycle mode", async () => {
    const a = await createUser(db, "a@example.com");
    await grantAccess(a);
    await expect(
      asUser(db, a, () =>
        q("update profiles set goals = '{weightloss}' where id = $1", [a]),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(db, a, () =>
        q("update profiles set cycle_mode = 'phase_synced' where id = $1", [a]),
      ),
    ).rejects.toThrow();
  });
});

describe("account deletion", () => {
  it("cascades to profile and consents", async () => {
    const a = await createUser(db, "a@example.com");
    await grantAccess(a);
    await asUser(db, a, () =>
      q(
        "insert into consents (user_id, kind, version) values ($1, 'terms', 'v1')",
        [a],
      ),
    );
    await q("delete from auth.users where id = $1", [a]);
    expect((await q("select * from profiles")).rows).toHaveLength(0);
    expect((await q("select * from consents")).rows).toHaveLength(0);
  });
});

describe("login gate", () => {
  it("allows known users and invited addresses only, and only for the service role", async () => {
    await createUser(db, "known@example.com");
    await q(
      "insert into invites (email, code_hash, expires_at) values ('new@example.com', 'h9', now() + interval '1 day')",
    );
    const check = async (email: string) => {
      await db.exec("set role service_role");
      try {
        return (await q("select can_request_login($1) as ok", [email])).rows[0]
          .ok;
      } finally {
        await db.exec("reset role");
      }
    };
    expect(await check("Known@Example.com")).toBe(true);
    expect(await check("new@example.com")).toBe(true);
    expect(await check("stranger@example.com")).toBe(false);

    const id = await createUser(db, "u@example.com");
    await expect(
      asUser(db, id, () => q("select can_request_login('x@example.com')")),
    ).rejects.toThrow(/permission denied/);
  });
});
