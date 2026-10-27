// Pins down the database rules of engine hints: privacy, one hint per day/kind/subject, params validation,
// and that a stale device can never undo a reaction (trigger suggestions_keep_reaction).
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createTestDb();
});

const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);

async function member(email: string) {
  const id = await createUser(db, email);
  await q("update profiles set access_granted_at = now() where id = $1", [id]);
  return id;
}

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";

const insert = (
  u: string,
  id = S1,
  kind = "readiness",
  day = "2026-10-02",
  subject = "",
  params = "{}",
  extra = "",
) =>
  q(
    `insert into suggestions (id, user_id, kind, day, subject, params ${extra ? "," + extra.split("=")[0] : ""})
     values ($1, $2, $3, $4, $5, $6::jsonb ${extra ? "," + extra.split("=")[1] : ""})`,
    [id, u, kind, day, subject, params],
  );

describe("suggestions", () => {
  it("members store suggestions for themselves; others cannot see them", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await asUser(db, a, () =>
      insert(
        a,
        S1,
        "readiness",
        "2026-10-02",
        "",
        '{"level":"lower","delta":-1.2}',
      ),
    );
    expect(
      (await asUser(db, a, () => q("select kind, status from suggestions")))
        .rows,
    ).toEqual([{ kind: "readiness", status: "shown" }]);
    expect(
      (await asUser(db, b, () => q("select * from suggestions"))).rows,
    ).toHaveLength(0);
    await expect(asUser(db, b, () => insert(a, S2))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("requires access and has no hard delete", async () => {
    const pending = await createUser(db, "p@example.com");
    await expect(asUser(db, pending, () => insert(pending))).rejects.toThrow(
      /row-level security/,
    );
    const a = await member("a@example.com");
    await asUser(db, a, () => insert(a));
    await expect(
      asUser(db, a, () => q("delete from suggestions")),
    ).rejects.toThrow(/permission denied/);
  });

  it("allows one active suggestion per day, kind and subject", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () =>
      insert(a, S1, "plateau", "2026-10-02", "barbell-bench-press"),
    );
    await expect(
      asUser(db, a, () =>
        insert(a, S2, "plateau", "2026-10-02", "barbell-bench-press"),
      ),
    ).rejects.toThrow(/duplicate|unique/);
    await asUser(db, a, () =>
      insert(a, S2, "plateau", "2026-10-02", "pull-up"),
    ); // other subject is fine
  });

  it("validates kind, status, params shape and size, day and subject length", async () => {
    const a = await member("a@example.com");
    await expect(
      asUser(db, a, () => insert(a, S1, "horoscope")),
    ).rejects.toThrow();
    await expect(
      asUser(db, a, () =>
        insert(a, S1, "readiness", "2026-10-02", "", "[1,2]"),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(db, a, () =>
        insert(
          a,
          S1,
          "readiness",
          "2026-10-02",
          "",
          JSON.stringify({ text: "x".repeat(2100) }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(db, a, () => insert(a, S1, "readiness", "2099-01-01")),
    ).rejects.toThrow();
    await expect(
      asUser(db, a, () =>
        insert(a, S1, "readiness", "2026-10-02", "x".repeat(65)),
      ),
    ).rejects.toThrow();
    await asUser(db, a, () => insert(a, S1));
    await expect(
      asUser(db, a, () =>
        q("update suggestions set status = 'liked' where id = $1", [S1]),
      ),
    ).rejects.toThrow();
    await asUser(db, a, () =>
      q(
        "update suggestions set status = 'dismissed', reacted_at = now() where id = $1",
        [S1],
      ),
    );
  });

  it("a stale device cannot delete or rewrite a reacted hint by sending it back as shown", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () =>
      insert(a, S1, "readiness", "2026-10-02", "lower", '{"level":"lower"}'),
    );
    await asUser(db, a, () =>
      q(
        "update suggestions set status = 'accepted', reacted_at = now() where id = $1",
        [S1],
      ),
    );
    await asUser(db, a, () =>
      q(
        "update suggestions set status = 'shown', reacted_at = null, deleted_at = now(), params = '{\"level\":\"x\"}' where id = $1",
        [S1],
      ),
    );
    const row = (
      await q(
        "select status, deleted_at, params from suggestions where id = $1",
        [S1],
      )
    ).rows[0];
    expect(row.status).toBe("accepted");
    expect(row.deleted_at).toBeNull();
    expect(row.params).toEqual({ level: "lower" });
  });

  it("never lets a stale device set a reacted hint back to shown", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () => insert(a));
    await asUser(db, a, () =>
      q(
        "update suggestions set status = 'dismissed', reacted_at = '2026-10-02T08:00:00Z' where id = $1",
        [S1],
      ),
    );
    await asUser(db, a, () =>
      q(
        "update suggestions set status = 'shown', reacted_at = null, params = '{\"level\":\"lower\"}' where id = $1",
        [S1],
      ),
    );
    const row = (
      await q(
        "select status, reacted_at, params from suggestions where id = $1",
        [S1],
      )
    ).rows[0];
    expect(row.status).toBe("dismissed");
    expect(row.reacted_at).not.toBeNull();
    // she can still change her mind
    await asUser(db, a, () =>
      q("update suggestions set status = 'accepted' where id = $1", [S1]),
    );
  });

  it("is removed with the account and purged when old and deleted", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () => insert(a));
    await q("update suggestions set deleted_at = now() - interval '40 days'");
    await db.exec("set role service_role");
    await q("select purge_deleted_rows(30)");
    await db.exec("reset role");
    expect(
      (await q("select count(*)::int as n from suggestions")).rows[0].n,
    ).toBe(0);
    await asUser(db, a, () => insert(a, S2));
    await q("delete from auth.users where id = $1", [a]);
    expect(
      (await q("select count(*)::int as n from suggestions")).rows[0].n,
    ).toBe(0);
  });
});
