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

const W1 = "11111111-1111-1111-1111-111111111111";
const E1 = "22222222-2222-2222-2222-222222222222";
const S1 = "33333333-3333-3333-3333-333333333333";

async function seedWorkout(u: string) {
  await asUser(db, u, async () => {
    await q(
      "insert into workouts (id, user_id, title, started_at) values ($1, $2, 'Push', now())",
      [W1, u],
    );
    await q(
      "insert into workout_exercises (id, user_id, workout_id, exercise_id, position) values ($1, $2, $3, 'barbell-bench-press', 0)",
      [E1, u, W1],
    );
    await q(
      "insert into workout_sets (id, user_id, workout_exercise_id, position, weight_kg, reps, rpe) values ($1, $2, $3, 0, 60, 8, 8.5)",
      [S1, u, E1],
    );
  });
}

describe("training tables", () => {
  it("members can log a workout with exercises and sets and read it back", async () => {
    const u = await member("a@example.com");
    await seedWorkout(u);
    const r = await asUser(db, u, () =>
      q("select weight_kg, reps from workout_sets"),
    );
    expect(r.rows).toEqual([{ weight_kg: "60.00", reps: 8 }]);
  });

  it("users without access cannot write", async () => {
    const u = await createUser(db, "pending@example.com");
    await expect(
      asUser(db, u, () =>
        q(
          "insert into workouts (id, user_id, started_at) values ($1, $2, now())",
          [W1, u],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("users never see or touch other users' rows", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await seedWorkout(a);
    expect(
      (await asUser(db, b, () => q("select * from workouts"))).rows,
    ).toHaveLength(0);
    const upd = await asUser(db, b, () =>
      q("update workouts set title = 'hacked' where id = $1 returning id", [
        W1,
      ]),
    );
    expect(upd.rows).toHaveLength(0);
  });

  it("cannot insert rows for another user", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await expect(
      asUser(db, b, () =>
        q(
          "insert into workouts (id, user_id, started_at) values ($1, $2, now())",
          [W1, a],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot attach children to another user's parent (composite FK)", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await seedWorkout(a);
    await expect(
      asUser(db, b, () =>
        q(
          "insert into workout_exercises (id, user_id, workout_id, exercise_id, position) values ('44444444-4444-4444-4444-444444444444', $1, $2, 'x', 0)",
          [b, W1],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("cannot hijack another user's row id via upsert", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await seedWorkout(a);
    await expect(
      asUser(db, b, () =>
        q(
          "insert into workouts (id, user_id, title, started_at) values ($1, $2, 'mine', now()) on conflict (id) do update set title = excluded.title",
          [W1, b],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      (await q("select title from workouts where id = $1", [W1])).rows[0].title,
    ).toBe("Push");
  });

  it("is idempotent: upserting the same id twice keeps one row", async () => {
    const u = await member("a@example.com");
    const upsert = () =>
      asUser(db, u, () =>
        q(
          "insert into workouts (id, user_id, title, started_at) values ($1, $2, 'Pull', now()) on conflict (id) do update set title = excluded.title",
          [W1, u],
        ),
      );
    await upsert();
    await upsert();
    expect((await q("select count(*)::int as n from workouts")).rows[0].n).toBe(
      1,
    );
  });

  it("stamps updated_at on the server and moves it forward on every write", async () => {
    const u = await member("a@example.com");
    await seedWorkout(u);
    const before = (
      await q("select updated_at from workouts where id = $1", [W1])
    ).rows[0].updated_at as Date;
    await asUser(db, u, () =>
      q(
        "update workouts set title = 'Push 2', updated_at = '2000-01-01' where id = $1",
        [W1],
      ),
    );
    const after = (
      await q("select updated_at from workouts where id = $1", [W1])
    ).rows[0].updated_at as Date;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it("owner and created_at cannot be changed after insert", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await seedWorkout(a);
    const created = (
      await q("select created_at from workouts where id = $1", [W1])
    ).rows[0].created_at as Date;
    await expect(
      asUser(db, a, () =>
        q("update workouts set user_id = $1 where id = $2", [b, W1]),
      ),
    ).resolves.toBeDefined();
    const row = (
      await q("select user_id, created_at from workouts where id = $1", [W1])
    ).rows[0];
    expect(row.user_id).toBe(a);
    expect(row.created_at).toEqual(created);
  });

  it("soft delete works and hard delete is not allowed", async () => {
    const u = await member("a@example.com");
    await seedWorkout(u);
    await asUser(db, u, () =>
      q("update workouts set deleted_at = now() where id = $1", [W1]),
    );
    expect(
      (await q("select deleted_at from workouts where id = $1", [W1])).rows[0]
        .deleted_at,
    ).not.toBeNull();
    await expect(
      asUser(db, u, () => q("delete from workouts where id = $1", [W1])),
    ).rejects.toThrow(/permission denied/);
  });

  it("rejects implausible values", async () => {
    const u = await member("a@example.com");
    await seedWorkout(u);
    for (const bad of [
      "weight_kg = 5000",
      "reps = -1",
      "rpe = 11",
      "set_type = 'sorcery'",
    ]) {
      await expect(
        asUser(db, u, () =>
          q(`update workout_sets set ${bad} where id = $1`, [S1]),
        ),
      ).rejects.toThrow();
    }
    await expect(
      asUser(db, u, () =>
        q(
          "update workouts set ended_at = started_at - interval '1 hour' where id = $1",
          [W1],
        ),
      ),
    ).rejects.toThrow();
  });

  it("account deletion removes all training data", async () => {
    const u = await member("a@example.com");
    await seedWorkout(u);
    await q("delete from auth.users where id = $1", [u]);
    for (const t of ["workouts", "workout_exercises", "workout_sets"]) {
      expect((await q(`select count(*)::int as n from ${t}`)).rows[0].n).toBe(
        0,
      );
    }
  });
});

describe("templates", () => {
  const T1 = "55555555-5555-5555-5555-555555555555";
  const TE1 = "66666666-6666-6666-6666-666666666666";

  it("members can create templates with exercises; others cannot see or attach to them", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    await asUser(db, a, async () => {
      await q(
        "insert into templates (id, user_id, name) values ($1, $2, 'Push A')",
        [T1, a],
      );
      await q(
        "insert into template_exercises (id, user_id, template_id, exercise_id, position, set_count) values ($1, $2, $3, 'barbell-bench-press', 0, 4)",
        [TE1, a, T1],
      );
    });
    expect(
      (await asUser(db, b, () => q("select * from templates"))).rows,
    ).toHaveLength(0);
    await expect(
      asUser(db, b, () =>
        q(
          "insert into template_exercises (id, user_id, template_id, exercise_id, position) values ('77777777-7777-7777-7777-777777777777', $1, $2, 'x', 0)",
          [b, T1],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("requires access, validates set_count, and blocks hard deletes", async () => {
    const pending = await createUser(db, "p@example.com");
    await expect(
      asUser(db, pending, () =>
        q("insert into templates (id, user_id, name) values ($1, $2, 'x')", [
          T1,
          pending,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);

    const a = await member("a@example.com");
    await asUser(db, a, () =>
      q("insert into templates (id, user_id, name) values ($1, $2, 'Push A')", [
        T1,
        a,
      ]),
    );
    await expect(
      asUser(db, a, () =>
        q(
          "insert into template_exercises (id, user_id, template_id, exercise_id, position, set_count) values ($1, $2, $3, 'x', 0, 99)",
          [TE1, a, T1],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(db, a, () => q("delete from templates where id = $1", [T1])),
    ).rejects.toThrow(/permission denied/);
  });

  it("is removed with the account", async () => {
    const a = await member("a@example.com");
    await asUser(db, a, () =>
      q("insert into templates (id, user_id, name) values ($1, $2, 'Push A')", [
        T1,
        a,
      ]),
    );
    await q("delete from auth.users where id = $1", [a]);
    expect(
      (await q("select count(*)::int as n from templates")).rows[0].n,
    ).toBe(0);
  });
});

describe("hardening", () => {
  it("ignores a client-supplied created_at on insert", async () => {
    const u = await member("a@example.com");
    await asUser(db, u, () =>
      q(
        "insert into workouts (id, user_id, started_at, created_at) values ($1, $2, now(), '2000-01-01')",
        [W1, u],
      ),
    );
    const { rows } = await q(
      "select created_at > now() - interval '1 minute' as fresh from workouts",
    );
    expect(rows[0].fresh).toBe(true);
  });

  it("purges old soft-deleted rows with their children, keeps recent and live ones", async () => {
    const u = await member("a@example.com");
    await seedWorkout(u);
    const W2 = "88888888-8888-8888-8888-888888888888";
    await asUser(db, u, () =>
      q(
        "insert into workouts (id, user_id, started_at) values ($1, $2, now())",
        [W2, u],
      ),
    );
    await q(
      "update workouts set deleted_at = now() - interval '40 days' where id = $1",
      [W1],
    );
    await q(
      "update workouts set deleted_at = now() - interval '2 days' where id = $1",
      [W2],
    );

    await db.exec("set role service_role");
    const purged = (await q("select purge_deleted_rows(30) as n")).rows[0].n;
    await db.exec("reset role");
    expect(purged).toBeGreaterThanOrEqual(1);
    const left = (await q("select id from workouts order by id")).rows.map(
      (r) => r.id,
    );
    expect(left).toEqual([W2]);
    expect(
      (await q("select count(*)::int as n from workout_sets")).rows[0].n,
    ).toBe(0); // cascaded

    const id = await member("b@example.com");
    await expect(
      asUser(db, id, () => q("select purge_deleted_rows(30)")),
    ).rejects.toThrow(/permission denied/);
    await db.exec("set role service_role");
    await expect(q("select purge_deleted_rows(1)")).rejects.toThrow(/refusing/);
    await db.exec("reset role");
  });

  it("keeps a deleted custom exercise while history still references it", async () => {
    const u = await member("a@example.com");
    const C1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const C2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await asUser(db, u, async () => {
      await q(
        "insert into custom_exercises (id, user_id, name) values ($1, $2, 'Zottman'), ($3, $2, 'Unused')",
        [C1, u, C2],
      );
      await q(
        "insert into workouts (id, user_id, started_at) values ($1, $2, now())",
        [W1, u],
      );
      await q(
        "insert into workout_exercises (id, user_id, workout_id, exercise_id, position) values ($1, $2, $3, $4, 0)",
        [E1, u, W1, C1],
      );
    });
    await q(
      "update custom_exercises set deleted_at = now() - interval '40 days'",
    );
    await db.exec("set role service_role");
    await q("select purge_deleted_rows(30)");
    await db.exec("reset role");
    const left = (await q("select name from custom_exercises")).rows.map(
      (r) => r.name,
    );
    expect(left).toEqual(["Zottman"]);
  });
});
