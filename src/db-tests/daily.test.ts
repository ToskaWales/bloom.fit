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

const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const B1 = "33333333-3333-4333-8333-333333333333";
const Y1 = "44444444-4444-4444-8444-444444444444";

const insertCheckin = (u: string, id = C1, day = "2026-10-02", extra = "") =>
  q(
    `insert into checkins (id, user_id, day, sleep_quality, energy, motivation, hunger ${extra ? "," + extra.split("=")[0] : ""})
     values ($1, $2, $3, 4, 3, 5, 2 ${extra ? "," + extra.split("=")[1] : ""})`,
    [id, u, day],
  );

describe("checkins", () => {
  it("members can write and read their check-in; others cannot see it", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await asUser(db, a, () => insertCheckin(a));
    expect(
      (await asUser(db, a, () => q("select energy from checkins"))).rows,
    ).toEqual([{ energy: 3 }]);
    expect(
      (await asUser(db, b, () => q("select * from checkins"))).rows,
    ).toHaveLength(0);
  });

  it("requires access and blocks writes for another user", async () => {
    const pending = await createUser(db, "p@example.com");
    await expect(
      asUser(db, pending, () => insertCheckin(pending)),
    ).rejects.toThrow(/row-level security/);
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await expect(asUser(db, b, () => insertCheckin(a))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("allows one active check-in per day but a new one after a soft delete", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () => insertCheckin(a, C1));
    await expect(asUser(db, a, () => insertCheckin(a, C2))).rejects.toThrow(
      /duplicate|unique/,
    );
    await asUser(db, a, () =>
      q("update checkins set deleted_at = now() where id = $1", [C1]),
    );
    await asUser(db, a, () => insertCheckin(a, C2));
  });

  it("validates scales, sleep hours, symptoms and the day", async () => {
    const a = await member("a@example.com");
    const bad = [
      "energy = 6",
      "energy = 0",
      "hunger = 9",
      "sleep_hours = 25",
      "symptoms = '{migraine}'",
      "symptoms = '{cramps,cramps,cramps,cramps,cramps,cramps,cramps,cramps,cramps,cramps,cramps,cramps,cramps}'",
      "day = '2099-01-01'",
      "note = repeat('x', 1001)",
    ];
    await asUser(db, a, () => insertCheckin(a));
    for (const set of bad) {
      await expect(
        asUser(db, a, () =>
          q(`update checkins set ${set} where id = $1`, [C1]),
        ),
      ).rejects.toThrow();
    }
    await asUser(db, a, () =>
      q(
        "update checkins set symptoms = '{cramps,headache}', sleep_hours = 7.5 where id = $1",
        [C1],
      ),
    );
  });

  it("is removed with the account and cannot be hard-deleted", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () => insertCheckin(a));
    await expect(
      asUser(db, a, () => q("delete from checkins")),
    ).rejects.toThrow(/permission denied/);
    await q("delete from auth.users where id = $1", [a]);
    expect((await q("select count(*)::int as n from checkins")).rows[0].n).toBe(
      0,
    );
  });
});

describe("bodyweight_entries", () => {
  it("stores one weight per day within plausible bounds", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () =>
      q(
        "insert into bodyweight_entries (id, user_id, day, weight_kg) values ($1, $2, '2026-10-02', 62.4)",
        [B1, a],
      ),
    );
    await expect(
      asUser(db, a, () =>
        q(
          "insert into bodyweight_entries (id, user_id, day, weight_kg) values ($1, $2, '2026-10-02', 62.5)",
          [C2, a],
        ),
      ),
    ).rejects.toThrow(/duplicate|unique/);
    for (const w of [10, 500]) {
      await expect(
        asUser(db, a, () =>
          q("update bodyweight_entries set weight_kg = $1", [w]),
        ),
      ).rejects.toThrow();
    }
  });

  it("is private and needs access", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    const pending = await createUser(db, "p@example.com");
    await asUser(db, a, () =>
      q(
        "insert into bodyweight_entries (id, user_id, day, weight_kg) values ($1, $2, '2026-10-02', 62)",
        [B1, a],
      ),
    );
    expect(
      (await asUser(db, b, () => q("select * from bodyweight_entries"))).rows,
    ).toHaveLength(0);
    await expect(
      asUser(db, pending, () =>
        q(
          "insert into bodyweight_entries (id, user_id, day, weight_kg) values ($1, $2, '2026-10-02', 62)",
          [C2, pending],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("cycle_events", () => {
  const ins = (u: string, id: string, kind: string, day: string) =>
    q(
      "insert into cycle_events (id, user_id, kind, day) values ($1, $2, $3, $4)",
      [id, u, kind, day],
    );

  it("stores period start/end and ovulation test events, one per kind and day", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () => ins(a, Y1, "period_start", "2026-10-05"));
    await asUser(db, a, () => ins(a, C1, "period_end", "2026-10-09"));
    await asUser(db, a, () =>
      ins(a, C2, "ovulation_test_positive", "2026-10-12"),
    );
    await expect(
      asUser(db, a, () => ins(a, B1, "period_start", "2026-10-05")),
    ).rejects.toThrow(/duplicate|unique/);
    await expect(
      asUser(db, a, () =>
        ins(
          a,
          "55555555-5555-4555-8555-555555555555",
          "phase_override",
          "2026-10-06",
        ),
      ),
    ).rejects.toThrow();
  });

  it("rejects future days and is private", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await expect(
      asUser(db, a, () => ins(a, Y1, "period_start", "2099-01-01")),
    ).rejects.toThrow();
    await asUser(db, a, () => ins(a, Y1, "period_start", "2026-10-05"));
    expect(
      (await asUser(db, b, () => q("select * from cycle_events"))).rows,
    ).toHaveLength(0);
  });
});

describe("purge", () => {
  it("also purges old soft-deleted daily rows", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, async () => {
      await insertCheckin(a);
      await q(
        "insert into bodyweight_entries (id, user_id, day, weight_kg) values ($1, $2, '2026-10-02', 62)",
        [B1, a],
      );
      await q(
        "insert into cycle_events (id, user_id, kind, day) values ($1, $2, 'period_start', '2026-10-05')",
        [Y1, a],
      );
    });
    await q("update checkins set deleted_at = now() - interval '40 days'");
    await q(
      "update bodyweight_entries set deleted_at = now() - interval '40 days'",
    );
    await q("update cycle_events set deleted_at = now() - interval '40 days'");
    await db.exec("set role service_role");
    await q("select purge_deleted_rows(30)");
    await db.exec("reset role");
    for (const t of ["checkins", "bodyweight_entries", "cycle_events"]) {
      expect((await q(`select count(*)::int as n from ${t}`)).rows[0].n).toBe(
        0,
      );
    }
  });
});

describe("hide_weight preference", () => {
  it("members can toggle it for themselves only", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    expect(
      (await q("select hide_weight from profiles where id = $1", [a])).rows[0]
        .hide_weight,
    ).toBe(false);
    await asUser(db, a, () =>
      q("update profiles set hide_weight = true where id = $1", [a]),
    );
    expect(
      (await q("select hide_weight from profiles where id = $1", [a])).rows[0]
        .hide_weight,
    ).toBe(true);
    const other = await asUser(db, a, () =>
      q("update profiles set hide_weight = true where id = $1 returning id", [
        b,
      ]),
    );
    expect(other.rows).toHaveLength(0);
  });
});

describe("per-user ids", () => {
  it("the same id can exist for two users without interfering (no probing or squatting)", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await asUser(db, b, () => insertCheckin(b, C1, "2026-10-02"));
    // a pushes the very same id for the same day: it is simply her own row
    await asUser(db, a, () =>
      q(
        `insert into checkins (id, user_id, day, energy) values ($1, $2, '2026-10-02', 5)
         on conflict (user_id, id) do update set energy = excluded.energy`,
        [C1, a],
      ),
    );
    expect(
      (await asUser(db, a, () => q("select energy from checkins"))).rows,
    ).toEqual([{ energy: 5 }]);
    expect(
      (await asUser(db, b, () => q("select energy from checkins"))).rows,
    ).toEqual([{ energy: 3 }]);
  });
});
