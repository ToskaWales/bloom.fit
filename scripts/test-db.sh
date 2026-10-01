#!/usr/bin/env bash
# Wendet alle Migrationen auf eine frische lokale Postgres-DB an (mit Supabase-Stub) und führt die RLS-Tests aus.
# Verbindung über die üblichen libpq-Variablen (PGHOST, PGUSER, PGPASSWORD, ...). Benötigt ein Superuser-Konto.
set -euo pipefail
cd "$(dirname "$0")/.."

DB=bloom_test
psql -v ON_ERROR_STOP=1 -d postgres -qc "drop database if exists $DB" -c "create database $DB"

run() { psql -v ON_ERROR_STOP=1 -d "$DB" -q -f "$1"; }
run supabase/tests/stub_supabase.sql
for f in supabase/migrations/*.sql; do
  echo "migration: $f"
  run "$f"
done
run supabase/tests/rls.sql
