import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Minimal stand-in for Supabase's auth schema and roles so migrations and
// RLS policies can run against real Postgres semantics in-process.
const SUPABASE_STUBS = `
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const dir = path.resolve(__dirname, "../../supabase/migrations");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  return db;
}

export async function createUser(
  db: PGlite,
  email: string,
  confirmed = true,
): Promise<string> {
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, email_confirmed_at) values ($1, case when $2::boolean then now() end) returning id",
    [email, confirmed],
  );
  return res.rows[0].id;
}

// Run `fn` as an authenticated user (RLS enforced), then reset.
export async function asUser<T>(
  db: PGlite,
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub', '', false);`,
    );
  }
}
