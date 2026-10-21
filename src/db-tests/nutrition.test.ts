import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createTestDb();
});

const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);

async function member(email: string, consent = true) {
  const id = await createUser(db, email);
  await q("update profiles set access_granted_at = now() where id = $1", [id]);
  if (consent)
    await q(
      "insert into consents (user_id, kind, version) values ($1, 'nutrition', 'v1')",
      [id],
    );
  return id;
}

const F1 = "11111111-1111-4111-8111-111111111111";
const F2 = "22222222-2222-4222-8222-222222222222";
const L1 = "33333333-3333-4333-8333-333333333333";

const insertFood = (
  u: string,
  id = F1,
  cols = "basis, kcal",
  vals = "'100g', 250",
) =>
  q(
    `insert into foods (id, user_id, name, ${cols}) values ($1, $2, 'Haferflocken', ${vals})`,
    [id, u],
  );
const insertLog = (
  u: string,
  id = L1,
  cols = "kcal",
  vals = "300",
  day = "2026-10-02",
) =>
  q(
    `insert into food_logs (id, user_id, day, ${cols}) values ($1, $2, $3, ${vals})`,
    [id, u, day],
  );

describe("foods", () => {
  it("members store their own foods; others cannot see them", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await asUser(db, a, () => insertFood(a));
    expect(
      (await asUser(db, a, () => q("select name from foods"))).rows,
    ).toHaveLength(1);
    expect(
      (await asUser(db, b, () => q("select name from foods"))).rows,
    ).toHaveLength(0);
    await expect(asUser(db, b, () => insertFood(a, F2))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("needs access to write", async () => {
    const pending = await createUser(db, "p@example.com");
    await expect(
      asUser(db, pending, () => insertFood(pending)),
    ).rejects.toThrow(/row-level security|nutrition consent required/);
  });

  it("requires kcal or protein, and rejects implausible values", async () => {
    const a = await member("a@example.com");
    await expect(
      asUser(db, a, () => insertFood(a, F1, "basis", "'100g'")),
    ).rejects.toThrow(/check/);
    await asUser(db, a, () =>
      insertFood(a, F1, "basis, protein_g", "'100g', 20"),
    );
    await expect(
      asUser(db, a, () => insertFood(a, F2, "basis, kcal", "'100g', 950")),
    ).rejects.toThrow(/check/);
    await expect(
      asUser(db, a, () => insertFood(a, F2, "basis, kcal", "'bad', 100")),
    ).rejects.toThrow(/check/);
    await expect(
      asUser(db, a, () =>
        insertFood(a, F2, "basis, kcal, carbs_g", "'100g', 100, -1"),
      ),
    ).rejects.toThrow(/check/);
    // a portion may exceed 900 kcal
    await asUser(db, a, () =>
      insertFood(a, F2, "basis, kcal, portion_g", "'portion', 1200, 400"),
    );
  });

  it("only accepts digit-only barcodes", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () =>
      insertFood(a, F1, "basis, kcal, barcode", "'100g', 100, '4001234567890'"),
    );
    await expect(
      asUser(db, a, () =>
        insertFood(a, F2, "basis, kcal, barcode", "'100g', 1, 'abc'"),
      ),
    ).rejects.toThrow(/check/);
  });

  it("cannot be hard-deleted by the client", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () => insertFood(a));
    await expect(asUser(db, a, () => q("delete from foods"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("food_logs", () => {
  it("stores snapshots without a food reference and isolates users", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await asUser(db, a, () =>
      insertLog(
        a,
        L1,
        "kcal, protein_g, name_snapshot, meal",
        "420, 30, 'Skyr', 'morning'",
      ),
    );
    expect(
      (await asUser(db, b, () => q("select * from food_logs"))).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(db, a, () => q("select kcal from food_logs"))).rows,
    ).toEqual([{ kcal: "420.0" }]);
  });

  it("allows several entries per day, needs kcal or protein, rejects bad meals and far-future days", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () => insertLog(a, L1));
    await asUser(db, a, () => insertLog(a, F2, "protein_g", "25"));
    await expect(
      asUser(db, a, () =>
        insertLog(a, "44444444-4444-4444-8444-444444444444", "carbs_g", "10"),
      ),
    ).rejects.toThrow(/check/);
    await expect(
      asUser(db, a, () =>
        insertLog(
          a,
          "55555555-5555-4555-8555-555555555555",
          "kcal, meal",
          "100, 'night'",
        ),
      ),
    ).rejects.toThrow(/check/);
    await expect(
      asUser(db, a, () =>
        insertLog(
          a,
          "66666666-6666-4666-8666-666666666666",
          "kcal",
          "100",
          "2099-01-01",
        ),
      ),
    ).rejects.toThrow(/check/);
  });
});

describe("nutrition_mode and consent", () => {
  it("is off by default and cannot be turned on without an active nutrition consent", async () => {
    const a = await member("a@example.com", false);
    expect(
      (await q("select nutrition_mode from profiles where id = $1", [a]))
        .rows[0].nutrition_mode,
    ).toBe("off");
    await expect(
      asUser(db, a, () =>
        q("update profiles set nutrition_mode = 'log' where id = $1", [a]),
      ),
    ).rejects.toThrow(/nutrition consent required/);
    await asUser(db, a, () =>
      q(
        "insert into consents (user_id, kind, version) values ($1, 'nutrition', 'v1')",
        [a],
      ),
    );
    await asUser(db, a, () =>
      q("update profiles set nutrition_mode = 'log_no_totals' where id = $1", [
        a,
      ]),
    );
    await expect(
      asUser(db, a, () =>
        q("update profiles set nutrition_mode = 'x' where id = $1", [a]),
      ),
    ).rejects.toThrow(/check/);
  });

  it("is switched off again when the consent is revoked", async () => {
    const a = await member("a@example.com", false);
    await asUser(db, a, () =>
      q(
        "insert into consents (user_id, kind, version) values ($1, 'nutrition', 'v1')",
        [a],
      ),
    );
    await asUser(db, a, () =>
      q("update profiles set nutrition_mode = 'log' where id = $1", [a]),
    );
    await asUser(db, a, () =>
      q(
        "update consents set revoked_at = now() where user_id = $1 and kind = 'nutrition'",
        [a],
      ),
    );
    expect(
      (await q("select nutrition_mode from profiles where id = $1", [a]))
        .rows[0].nutrition_mode,
    ).toBe("off");
  });

  it("can be changed for yourself only", async () => {
    const a = await member("a@example.com", false);
    const b = await member("b@example.com", false);
    await asUser(db, a, () =>
      q(
        "insert into consents (user_id, kind, version) values ($1, 'nutrition', 'v1')",
        [a],
      ),
    );
    const other = await asUser(db, a, () =>
      q(
        "update profiles set nutrition_mode = 'log' where id = $1 returning id",
        [b],
      ),
    );
    expect(other.rows).toHaveLength(0);
  });
});

describe("consent on the data tables", () => {
  it("rejects writes without an active consent, but lets soft deletes through", async () => {
    const a = await member("a@example.com", false);
    await expect(asUser(db, a, () => insertFood(a))).rejects.toThrow(
      /nutrition consent required/,
    );
    await expect(asUser(db, a, () => insertLog(a))).rejects.toThrow(
      /nutrition consent required/,
    );
    await q(
      "insert into consents (user_id, kind, version) values ($1, 'nutrition', 'v1')",
      [a],
    );
    await asUser(db, a, () => insertLog(a));
    await q(
      "update consents set revoked_at = now() where user_id = $1 and kind = 'nutrition'",
      [a],
    );
    await expect(
      asUser(db, a, () =>
        q("update food_logs set deleted_at = null where id = $1", [L1]),
      ),
    ).rejects.toThrow(/nutrition consent required/);
    await asUser(db, a, () =>
      q("update food_logs set deleted_at = now() where id = $1", [L1]),
    );
  });

  it("withdrawing the consent soft-deletes entries, foods and intake-derived hints, and leaves other data alone", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () => insertFood(a));
    await asUser(db, a, () => insertLog(a));
    await q(
      `insert into suggestions (id, user_id, kind, day, subject, params) values
       ('77777777-7777-4777-8777-777777777777', $1, 'safety', '2026-10-02', 'energy', '{"lowIntake":true}'),
       ('88888888-8888-4888-8888-888888888888', $1, 'readiness', '2026-10-02', 'lower', '{"level":"lower"}')`,
      [a],
    );
    await asUser(db, a, () =>
      q("update consents set revoked_at = now() where kind = 'nutrition'"),
    );
    const live = async (t: string) =>
      (await q(`select count(*)::int as n from ${t} where deleted_at is null`))
        .rows[0].n;
    expect(await live("food_logs")).toBe(0);
    expect(await live("foods")).toBe(0);
    expect(
      (await q("select kind from suggestions where deleted_at is null")).rows,
    ).toEqual([{ kind: "readiness" }]);
  });
});

describe("barcode index", () => {
  it("allows the same barcode twice (offline devices), duplicates are harmless", async () => {
    const a = await member("a@example.com");
    const withCode = (id: string) =>
      insertFood(a, id, "basis, kcal, barcode", "'100g', 100, '4001234567890'");
    await asUser(db, a, () => withCode(F1));
    await asUser(db, a, () => withCode(F2));
    expect((await q("select count(*)::int as n from foods")).rows[0].n).toBe(2);
  });
});

describe("consume_food_lookup", () => {
  const consume = (u: string) =>
    asUser(
      db,
      u,
      async () => (await q("select consume_food_lookup() as r")).rows[0].r,
    );

  it("is not allowed while nutrition is off, without consent or without access", async () => {
    const a = await member("a@example.com");
    expect(await consume(a)).toBe("not_allowed"); // mode off
    const noConsent = await member("n@example.com", false);
    expect(await consume(noConsent)).toBe("not_allowed");
    const pending = await createUser(db, "p@example.com");
    expect(await consume(pending)).toBe("not_allowed");
  });

  it("takes no arguments, so a caller cannot choose the limits", async () => {
    const a = await member("a@example.com");
    await expect(
      asUser(db, a, () => q("select consume_food_lookup(1000000, 1000000)")),
    ).rejects.toThrow(/does not exist|function/);
  });

  it("allows 20 lookups per window, then limits; a new window starts after ten minutes", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () =>
      q("update profiles set nutrition_mode = 'log' where id = $1", [a]),
    );
    for (let i = 0; i < 20; i++) expect(await consume(a)).toBe("ok");
    expect(await consume(a)).toBe("limited");
    await q(
      "update food_lookup_quota set window_start = now() - interval '11 minutes'",
    );
    expect(await consume(a)).toBe("ok");
  });

  it("holds a daily limit of 100 across windows", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () =>
      q("update profiles set nutrition_mode = 'log' where id = $1", [a]),
    );
    expect(await consume(a)).toBe("ok");
    await q(
      "update food_lookup_quota set window_start = now() - interval '11 minutes', day_count = 100",
    );
    expect(await consume(a)).toBe("limited");
    await q(
      "update food_lookup_quota set window_start = now() - interval '11 minutes', day_start = now() - interval '25 hours'",
    );
    expect(await consume(a)).toBe("ok");
  });

  it("keeps separate counters per user and the table is not readable by clients", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    for (const u of [a, b])
      await asUser(db, u, () =>
        q("update profiles set nutrition_mode = 'log' where id = $1", [u]),
      );
    await q(
      "insert into food_lookup_quota (user_id, window_count) values ($1, 25)",
      [a],
    );
    expect(await consume(a)).toBe("limited");
    expect(await consume(b)).toBe("ok");
    await expect(
      asUser(db, a, () => q("select * from food_lookup_quota")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("purge", () => {
  it("purges old soft-deleted foods and logs", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () => insertFood(a));
    await asUser(db, a, () => insertLog(a));
    await q("update foods set deleted_at = now() - interval '40 days'");
    await q("update food_logs set deleted_at = now() - interval '40 days'");
    await db.exec("set role service_role");
    await q("select purge_deleted_rows(30)");
    await db.exec("reset role");
    expect((await q("select count(*)::int as n from foods")).rows[0].n).toBe(0);
    expect(
      (await q("select count(*)::int as n from food_logs")).rows[0].n,
    ).toBe(0);
  });
});
