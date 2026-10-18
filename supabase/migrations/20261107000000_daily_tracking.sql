-- Daily tracking: check-ins, bodyweight and cycle events. Same sync model as
-- the training log (client ids, server-stamped updated_at, soft delete).
-- Days are local calendar dates chosen by the device; one active row per day
-- (check-in, weight) or per kind and day (cycle event). The client derives the
-- row id from user + day, so two offline devices converge on the same row.

create table public.checkins (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null check (day <= current_date + 1), -- +1: device may be ahead of UTC
  sleep_quality smallint check (sleep_quality between 1 and 5),
  sleep_hours numeric(3, 1) check (sleep_hours between 0 and 24),
  energy smallint check (energy between 1 and 5),
  motivation smallint check (motivation between 1 and 5),
  hunger smallint check (hunger between 1 and 5),
  symptoms text[] not null default '{}'
    check (
      cardinality(symptoms) <= 12
      and symptoms <@ array['cramps', 'headache', 'bloating', 'mood_swings', 'sore_muscles',
                            'back_pain', 'breast_tenderness', 'cravings']::text[]
    ),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create unique index checkins_one_per_day on public.checkins (user_id, day) where deleted_at is null;

create table public.bodyweight_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null check (day <= current_date + 1),
  weight_kg numeric(5, 2) not null check (weight_kg between 30 and 300),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create unique index bodyweight_one_per_day on public.bodyweight_entries (user_id, day) where deleted_at is null;

create table public.cycle_events (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('period_start', 'period_end', 'ovulation_test_positive')),
  day date not null check (day <= current_date + 1),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create unique index cycle_events_one_per_kind_day on public.cycle_events (user_id, kind, day) where deleted_at is null;

create index checkins_pull_idx on public.checkins (user_id, updated_at);
create index bodyweight_pull_idx on public.bodyweight_entries (user_id, updated_at);
create index cycle_events_pull_idx on public.cycle_events (user_id, updated_at);

do $$
declare
  t text;
begin
  foreach t in array array['checkins', 'bodyweight_entries', 'cycle_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = auth.uid())',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid() and public.has_access())',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = auth.uid() and public.has_access()) with check (user_id = auth.uid() and public.has_access())',
      t || '_update_own', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.stamp_row()',
      t || '_stamp', t);
  end loop;
end $$;

-- Preference: hide everything about bodyweight (entry, trend, charts).
alter table public.profiles add column hide_weight boolean not null default false;
grant update (hide_weight) on public.profiles to authenticated;
