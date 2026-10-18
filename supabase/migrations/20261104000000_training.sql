-- Training log. Clients are offline-first and generate row ids, so every write
-- is an idempotent upsert by id. updated_at is stamped by the server (it is
-- the pull cursor); deletes are soft (deleted_at) so they sync to other devices.
-- The exercise catalog is static app data; workout_exercises.exercise_id holds a
-- catalog slug or the uuid of a custom exercise.

create function public.stamp_row() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  if tg_op = 'INSERT' then
    new.created_at = clock_timestamp(); -- never client-controlled
  else
    new.created_at = old.created_at;
    new.user_id = old.user_id;
  end if;
  return new;
end $$;

create table public.custom_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  muscle_group text check (char_length(muscle_group) <= 40),
  equipment text check (char_length(equipment) <= 40),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text check (char_length(title) <= 80),
  started_at timestamptz not null,
  ended_at timestamptz check (ended_at is null or ended_at >= started_at),
  notes text check (char_length(notes) <= 2000),
  source text not null default 'app' check (source in ('app', 'hevy', 'strong')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.workout_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null,
  exercise_id text not null check (char_length(exercise_id) between 1 and 64),
  position integer not null check (position >= 0),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  unique (id, user_id),
  -- a child can only point at a parent owned by the same user
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade
);

create table public.workout_sets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_exercise_id uuid not null,
  position integer not null check (position >= 0),
  set_type text not null default 'normal' check (set_type in ('normal', 'warmup', 'drop', 'failure')),
  weight_kg numeric(6, 2) check (weight_kg between 0 and 1000),
  reps smallint check (reps between 0 and 1000),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  completed boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  foreign key (workout_exercise_id, user_id)
    references public.workout_exercises (id, user_id) on delete cascade
);

create index custom_exercises_pull_idx on public.custom_exercises (user_id, updated_at);
create index workouts_pull_idx on public.workouts (user_id, updated_at);
create index workout_exercises_pull_idx on public.workout_exercises (user_id, updated_at);
create index workout_sets_pull_idx on public.workout_sets (user_id, updated_at);
create index workouts_started_idx on public.workouts (user_id, started_at desc) where deleted_at is null;

do $$
declare
  t text;
begin
  foreach t in array array['custom_exercises', 'workouts', 'workout_exercises', 'workout_sets'] loop
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
-- No delete grant: clients soft-delete via deleted_at.
