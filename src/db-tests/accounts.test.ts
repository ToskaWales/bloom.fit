import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createTestDb();
});

const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params);

describe("profile creation and invite gate", () => {
  it("creates a pending profile for uninvited users", async () => {
    const id = await createUser(db, "x@example.com");
    const { rows } = await q("select access_granted_at from profiles where id = $1", [id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].access_granted_at).toBeNull();
  });

  it("grants access immediately when the email has an open invite", async () => {
    await q("insert into invites (email, code_hash, expires_at) values ('a@example.com', 'h1', now() + interval '7 days')");
    const id = await createUser(db, "A@Example.com");
    const { rows } = await q("select access_granted_at from profiles where id = $1", [id]);
    expect(rows[0].access_granted_at).not.toBeNull();
    const inv = await q("select redeemed_by from invites where code_hash = 'h1'");
    expect(inv.rows[0].redeemed_by).toBe(id);
  });

  it("ignores expired invites", async () => {
    await q("insert into invites (email, code_hash, expires_at) values ('a@example.com', 'h1', now() - interval '1 day')");
    const id = await createUser(db, "a@example.com");
    const { rows } = await q("select access_granted_at from profiles where id = $1", [id]);
    expect(rows[0].access_granted_at).toBeNull();
  });

  it("redeems a code once (Apple relay / different email case)", async () => {
    await q("insert into invites (email, code_hash, expires_at) values ('other@example.com', encode(sha256(convert_to('secret-code', 'UTF8')), 'hex'), now() + interval '7 days')");
    const id = await createUser(db, "relay@privaterelay.appleid.com");
    const first = await asUser(db, id, () => q("select redeem_invite('secret-code') as ok"));
    expect(first.rows[0].ok).toBe(true);
    const { rows } = await q("select access_granted_at from profiles where id = $1", [id]);
    expect(rows[0].access_granted_at).not.toBeNull();

    const second = await createUser(db, "second@example.com");
    const again = await asUser(db, second, () => q("select redeem_invite('secret-code') as ok"));
    expect(again.rows[0].ok).toBe(false);
  });

  it("rejects wrong codes", async () => {
    const id = await createUser(db, "z@example.com");
    const r = await asUser(db, id, () => q("select redeem_invite('nope') as ok"));
    expect(r.rows[0].ok).toBe(false);
  });
});

describe("row level security", () => {
  it("users only see and edit their own profile", async () => {
    const a = await createUser(db, "a@example.com");
    const b = await createUser(db, "b@example.com");
    const seen = await asUser(db, a, () => q("select id from profiles"));
    expect(seen.rows.map((r) => r.id)).toEqual([a]);
    const upd = await asUser(db, a, () => q("update profiles set units = 'imperial' where id = $1 returning id", [b]));
    expect(upd.rows).toHaveLength(0);
  });

  it("users cannot grant themselves access", async () => {
    const a = await createUser(db, "a@example.com");
    await expect(
      asUser(db, a, () => q("update profiles set access_granted_at = now() where id = $1", [a])),
    ).rejects.toThrow(/permission denied/);
  });

  it("users cannot read invites", async () => {
    const a = await createUser(db, "a@example.com");
    await expect(asUser(db, a, () => q("select * from invites"))).rejects.toThrow(/permission denied/);
  });

  it("consents are private, insert-only for the owner, revocable", async () => {
    const a = await createUser(db, "a@example.com");
    const b = await createUser(db, "b@example.com");
    await asUser(db, a, () => q("insert into consents (user_id, kind, version) values ($1, 'terms', '2026-11')", [a]));
    await expect(
      asUser(db, a, () => q("insert into consents (user_id, kind, version) values ($1, 'terms', '2026-11')", [b])),
    ).rejects.toThrow();
    const bSees = await asUser(db, b, () => q("select * from consents"));
    expect(bSees.rows).toHaveLength(0);
    await asUser(db, a, () => q("update consents set revoked_at = now() where user_id = $1 and kind = 'terms'", [a]));
    await expect(
      asUser(db, a, () => q("delete from consents where user_id = $1", [a])),
    ).rejects.toThrow(/permission denied/);
  });

  it("allows only one active consent per kind", async () => {
    const a = await createUser(db, "a@example.com");
    await asUser(db, a, () => q("insert into consents (user_id, kind, version) values ($1, 'terms', 'v1')", [a]));
    await expect(
      asUser(db, a, () => q("insert into consents (user_id, kind, version) values ($1, 'terms', 'v2')", [a])),
    ).rejects.toThrow(/duplicate|unique/);
  });
});

describe("onboarding completion", () => {
  it("requires active terms and health_data consent", async () => {
    const a = await createUser(db, "a@example.com");
    await expect(
      asUser(db, a, () => q("update profiles set onboarding_completed_at = now() where id = $1", [a])),
    ).rejects.toThrow(/consent/i);
    await asUser(db, a, () =>
      q("insert into consents (user_id, kind, version) values ($1, 'terms', 'v1'), ($1, 'health_data', 'v1')", [a]),
    );
    const ok = await asUser(db, a, () =>
      q("update profiles set onboarding_completed_at = now() where id = $1 returning id", [a]),
    );
    expect(ok.rows).toHaveLength(1);
  });

  it("validates goals and cycle mode", async () => {
    const a = await createUser(db, "a@example.com");
    await expect(
      asUser(db, a, () => q("update profiles set goals = '{weightloss}' where id = $1", [a])),
    ).rejects.toThrow();
    await expect(
      asUser(db, a, () => q("update profiles set cycle_mode = 'phase_synced' where id = $1", [a])),
    ).rejects.toThrow();
  });
});

describe("account deletion", () => {
  it("cascades to profile and consents", async () => {
    const a = await createUser(db, "a@example.com");
    await asUser(db, a, () => q("insert into consents (user_id, kind, version) values ($1, 'terms', 'v1')", [a]));
    await q("delete from auth.users where id = $1", [a]);
    expect((await q("select * from profiles")).rows).toHaveLength(0);
    expect((await q("select * from consents")).rows).toHaveLength(0);
  });
});
