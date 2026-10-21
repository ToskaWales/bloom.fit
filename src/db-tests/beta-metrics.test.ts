import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, createUser } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createTestDb();
});
const q = (sql: string, params: unknown[] = []) =>
  db.query<Record<string, unknown>>(sql, params);
const sql = readFileSync(
  path.resolve(__dirname, "../../supabase/queries/beta_metrics.sql"),
  "utf8",
);

async function member(email: string, accessDaysAgo: number, mode = "natural") {
  const id = await createUser(db, email);
  await q(
    "update profiles set access_granted_at = now() - make_interval(days => $2), cycle_mode = $3 where id = $1",
    [id, accessDaysAgo, mode],
  );
  return id;
}
const checkin = (u: string, daysAgo: number, n: number) =>
  q(
    `insert into checkins (id, user_id, day, energy) values (gen_random_uuid(), $1, current_date - $2::int, 3)`,
    [u, daysAgo + n],
  );

const metrics = async () =>
  Object.fromEntries(
    (await q(sql)).rows.map((r) => [r.metric, [r.n, r.of]]),
  ) as Record<string, [number, number]>;

describe("beta_metrics.sql", () => {
  it("counts activation, week-4 retention and opt-ins without reading health values", async () => {
    // access 40 days ago: logs 8 days in the first 14 and again in week 4
    const a = await member("a@example.com", 40);
    for (let i = 0; i < 8; i++) await checkin(a, 40, -i); // days 0..7 after access
    await checkin(a, 40, -23); // day 23 after access
    // access 30 days ago: only 3 days, nothing in week 4
    const b = await member("b@example.com", 30, "none");
    for (let i = 0; i < 3; i++) await checkin(b, 30, -i);
    // access 5 days ago: too new to count in the denominators
    await member("c@example.com", 5);
    const m = await metrics();
    expect(m["members with access"]).toEqual([3, 3]);
    expect(m["activated: 7+ activity days in the first 14"]).toEqual([1, 2]);
    expect(m["retained: active in week 4"]).toEqual([1, 2]);
    expect(m["tracks cycle (natural or irregular)"]).toEqual([2, 3]);
    expect(m["nutrition switched on"]).toEqual([0, 3]);
  });

  it("counts hint reactions per kind and ignores people without access", async () => {
    const a = await member("a@example.com", 10);
    await createUser(db, "pending@example.com");
    await q(
      `insert into suggestions (id, user_id, kind, day, subject, params, status) values
       (gen_random_uuid(), $1, 'readiness', current_date - 3, 'lower', '{}', 'accepted'),
       (gen_random_uuid(), $1, 'readiness', current_date - 2, 'higher', '{}', 'dismissed'),
       (gen_random_uuid(), $1, 'plateau', current_date - 2, 'x', '{}', 'shown')`,
      [a],
    );
    const m = await metrics();
    expect(m["members with access"]).toEqual([1, 1]);
    expect(m["hints accepted: readiness"]).toEqual([1, 2]);
    expect(m["hints dismissed: readiness"]).toEqual([1, 2]);
    expect(m["hints accepted: plateau"]).toEqual([0, 1]);
  });

  it("never touches health value columns or identifiers", () => {
    expect(sql).not.toMatch(
      /\b(email|weight_kg|kcal|protein_g|carbs_g|fat_g|note|symptoms|energy|hunger|name_snapshot|params)\b/i,
    );
  });
});
