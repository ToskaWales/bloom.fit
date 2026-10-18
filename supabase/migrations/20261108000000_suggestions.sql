-- Suggestions produced by the on-device adaptation engine. Only the kind, day,
-- a few numbers and the user's reaction are stored; the German text is built on
-- the device from these numbers. Same sync model as the other tables.

create table public.suggestions (
  id uuid not null,
  primary key (user_id, id),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('readiness', 'plateau', 'pattern', 'safety', 'hunger_note')),
  day date not null check (day <= current_date + 1),
  subject text not null default '' check (char_length(subject) <= 64), -- e.g. the exercise a plateau is about
  params jsonb not null default '{}'
    check (jsonb_typeof(params) = 'object' and char_length(params::text) <= 2000),
  status text not null default 'shown' check (status in ('shown', 'accepted', 'dismissed')),
  reacted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create unique index suggestions_one_per_subject on public.suggestions (user_id, day, kind, subject) where deleted_at is null;
create index suggestions_pull_idx on public.suggestions (user_id, updated_at);

alter table public.suggestions enable row level security;
revoke all on public.suggestions from anon, authenticated;
grant select, insert, update on public.suggestions to authenticated;
create policy suggestions_select_own on public.suggestions for select to authenticated using (user_id = auth.uid());
create policy suggestions_insert_own on public.suggestions for insert to authenticated
  with check (user_id = auth.uid() and public.has_access());
create policy suggestions_update_own on public.suggestions for update to authenticated
  using (user_id = auth.uid() and public.has_access()) with check (user_id = auth.uid() and public.has_access());
create trigger suggestions_stamp before insert or update on public.suggestions
  for each row execute function public.stamp_row();

-- A reaction is one-way: a device that still shows the hint as "shown" (synced
-- late, or re-derived by the engine) must not overwrite an accepted/dismissed one.
create function public.suggestions_keep_reaction() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'shown' and new.status = 'shown' then
    new.status = old.status;
    new.reacted_at = old.reacted_at;
  end if;
  return new;
end $$;
create trigger suggestions_keep_reaction before update on public.suggestions
  for each row execute function public.suggestions_keep_reaction();

-- Replaces the purge function from 20261106 so that the daily-tracking tables
-- and suggestions are purged as well (migrations stay append-only).
create or replace function public.purge_deleted_rows(older_than_days integer default 30) returns integer
language plpgsql security definer set search_path = public as $$
declare
  cutoff timestamptz := now() - make_interval(days => older_than_days);
  removed integer := 0;
  n integer;
  t text;
begin
  if older_than_days < 7 then
    raise exception 'refusing to purge rows younger than 7 days';
  end if;
  -- parents first; their children go with them (on delete cascade)
  foreach t in array array['workouts', 'templates', 'workout_exercises', 'template_exercises', 'workout_sets',
                          'checkins', 'bodyweight_entries', 'cycle_events', 'suggestions'] loop
    execute format('delete from public.%I where deleted_at is not null and deleted_at < $1', t) using cutoff;
    get diagnostics n = row_count;
    removed := removed + n;
  end loop;
  -- A deleted custom exercise is kept while history still refers to it (the
  -- reference is plain text, so purging it would lose the exercise's name).
  delete from public.custom_exercises ce
    where ce.deleted_at is not null and ce.deleted_at < cutoff
      and not exists (select 1 from public.workout_exercises we where we.user_id = ce.user_id and we.exercise_id = ce.id::text)
      and not exists (select 1 from public.template_exercises te where te.user_id = ce.user_id and te.exercise_id = ce.id::text);
  get diagnostics n = row_count;
  removed := removed + n;
  return removed;
end $$;
revoke all on function public.purge_deleted_rows(integer) from public, anon, authenticated;
grant execute on function public.purge_deleted_rows(integer) to service_role;
