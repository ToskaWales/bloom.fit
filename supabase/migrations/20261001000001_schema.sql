-- Bloom – Schema (Phase 2). Entscheidungen siehe docs/ENTSCHEIDUNGEN.md.
-- Konventionen: ids kommen vom Client (offline-first), user_id auf jeder Tabelle (einfaches RLS),
-- Datum = lokales Kalenderdatum der Nutzerin.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------- Enums
create type public.training_goal as enum ('muscle_gain', 'recomposition', 'other');
create type public.training_experience as enum ('intermediate', 'advanced', 'other');
-- Sonderfälle (E8): Engine läuft trotzdem, braucht aber mehr Logs; Schwangerschaft -> pausiert.
create type public.cycle_context as enum (
  'regular', 'irregular', 'hormonal_contraception', 'pregnant_or_postpartum', 'perimenopause_menopause'
);
create type public.engine_mode as enum ('adaptive', 'descriptive_only', 'paused');
create type public.consent_type as enum ('health_data', 'privacy_policy');
create type public.cycle_source as enum ('manual', 'healthkit', 'health_connect');
-- Interne DB-Werte; für Nutzerinnen gelten weiter die Formulierungsregeln aus CLAUDE.md.
create type public.cycle_phase as enum ('menstruation', 'follicular', 'ovulation', 'luteal');
create type public.adjustment_metric as enum ('volume');
create type public.adjustment_status as enum ('active', 'lifted_auto', 'lifted_manual');

-- ---------------------------------------------------------------- Helpers
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  default_cycle_length smallint not null default 28 check (default_cycle_length between 21 and 45),
  training_goal public.training_goal,
  training_experience public.training_experience,
  cycle_context public.cycle_context not null default 'regular',
  engine_mode public.engine_mode not null default 'adaptive',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sicherheitsnetz: bei Schwangerschaft/Postpartum gibt die Engine keine Vorgaben (E8).
create function public.profiles_enforce_engine_mode() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cycle_context = 'pregnant_or_postpartum' then
    new.engine_mode = 'paused';
  end if;
  return new;
end;
$$;

create trigger profiles_engine_mode before insert or update on public.profiles
  for each row execute function public.profiles_enforce_engine_mode();

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- user_consents (DSGVO Art. 9)
create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type public.consent_type not null,
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= granted_at)
);
create index user_consents_user_idx on public.user_consents (user_id, consent_type);

-- ---------------------------------------------------------------- cycles
create table public.cycles (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  period_end date,
  source public.cycle_source not null default 'manual',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end is null or period_end >= period_start),
  unique (user_id, period_start),
  -- Zeiträume einer Nutzerin dürfen sich nicht überlappen (laufende Periode = ein Tag)
  exclude using gist (
    user_id with =,
    daterange(period_start, coalesce(period_end, period_start), '[]') with &&
  )
);
create unique index cycles_external_idx on public.cycles (user_id, source, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------- exercises
-- user_id null = globaler Katalog (nur lesbar), sonst eigene Übung.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index exercises_name_idx
  on public.exercises (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- ---------------------------------------------------------------- Training
create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  performed_on date not null,
  started_at timestamptz,
  ended_at timestamptz,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at),
  unique (id, user_id)
);
create index workouts_user_date_idx on public.workouts (user_id, performed_on);

create table public.workout_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null references public.exercises (id),
  position smallint not null check (position >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Kind gehört immer derselben Nutzerin wie der Parent
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index workout_exercises_exercise_idx on public.workout_exercises (user_id, exercise_id);

create table public.sets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_exercise_id uuid not null,
  set_index smallint not null check (set_index >= 0),
  weight_kg numeric(6, 2) not null check (weight_kg >= 0),
  reps smallint not null check (reps between 1 and 100),
  rpe numeric(3, 1) check (rpe between 1 and 10 and rpe * 2 = trunc(rpe * 2)),
  is_warmup boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workout_exercise_id, user_id)
    references public.workout_exercises (id, user_id) on delete cascade
);
create index sets_workout_exercise_idx on public.sets (workout_exercise_id);

-- ---------------------------------------------------------------- Ernährung (pro Lebensmittel)
create table public.nutrition_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  name text not null check (length(btrim(name)) between 1 and 200),
  barcode text,
  quantity_g numeric(7, 1) check (quantity_g > 0),
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index nutrition_entries_user_date_idx on public.nutrition_entries (user_id, logged_on);

-- ---------------------------------------------------------------- Tägliches Check-in
create table public.daily_checkins (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  checkin_on date not null,
  sleep_hours numeric(3, 1) not null check (sleep_hours between 0 and 24),
  motivation smallint not null check (motivation between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- ein Eintrag pro Nutzerin und Tag; erneutes Speichern = Upsert
  unique (user_id, checkin_on)
);

-- ---------------------------------------------------------------- Adaptive Engine
create table public.phase_adjustments (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  phase public.cycle_phase not null,
  target_metric public.adjustment_metric not null default 'volume',
  factor numeric(5, 3) not null check (factor > 0),
  basis_cycles smallint not null check (basis_cycles >= 0),
  confirming_cycles smallint not null default 0 check (confirming_cycles >= 0),
  contradicting_cycles smallint not null default 0 check (contradicting_cycles >= 0),
  status public.adjustment_status not null default 'active',
  lifted_at timestamptz,
  lifted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active') = (lifted_at is null)),
  unique (user_id, phase, target_metric)
);

-- ---------------------------------------------------------------- updated_at-Trigger
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'user_consents', 'cycles', 'exercises', 'workouts', 'workout_exercises', 'sets',
    'nutrition_entries', 'daily_checkins', 'phase_adjustments'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end $$;
