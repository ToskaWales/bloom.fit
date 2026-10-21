-- Nutrition logging (optional, off by default). Same sync model as the other
-- tables. Food values are copied into each log entry (snapshot), so history and
-- export survive a deleted food. Only energy and protein are required.

create table public.foods (
  id uuid not null,
  primary key (user_id, id),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  brand text check (char_length(brand) <= 80),
  barcode text check (barcode ~ '^[0-9]{6,32}$'),
  basis text not null check (basis in ('100g', 'portion')),
  portion_g numeric(6, 1) check (portion_g > 0 and portion_g <= 2000),
  kcal numeric(6, 1) check (kcal >= 0 and kcal <= 5000),
  protein_g numeric(5, 1) check (protein_g >= 0 and protein_g <= 500),
  carbs_g numeric(5, 1) check (carbs_g >= 0 and carbs_g <= 500),
  fat_g numeric(5, 1) check (fat_g >= 0 and fat_g <= 500),
  source text not null default 'own' check (source in ('own', 'off')),
  favorite boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  check (kcal is not null or protein_g is not null),
  check (basis <> '100g' or kcal is null or kcal <= 900)
);
create unique index foods_one_per_barcode on public.foods (user_id, barcode) where deleted_at is null and barcode is not null;

create table public.food_logs (
  id uuid not null,
  primary key (user_id, id),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null check (day <= current_date + 1),
  meal text check (meal in ('morning', 'midday', 'evening', 'snack')),
  food_id uuid, -- plain reference (no foreign key): the snapshot below is what counts
  name_snapshot text not null default '' check (char_length(name_snapshot) <= 80),
  amount_g numeric(6, 1) check (amount_g > 0 and amount_g <= 3000),
  kcal numeric(6, 1) check (kcal >= 0 and kcal <= 10000),
  protein_g numeric(5, 1) check (protein_g >= 0 and protein_g <= 1000),
  carbs_g numeric(5, 1) check (carbs_g >= 0 and carbs_g <= 1000),
  fat_g numeric(5, 1) check (fat_g >= 0 and fat_g <= 1000),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  check (kcal is not null or protein_g is not null)
);
create index food_logs_day_idx on public.food_logs (user_id, day);
create index foods_pull_idx on public.foods (user_id, updated_at);
create index food_logs_pull_idx on public.food_logs (user_id, updated_at);

do $$
declare
  t text;
begin
  foreach t in array array['foods', 'food_logs'] loop
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

-- Preference: nutrition logging is off until she turns it on. 'log_no_totals'
-- shows the entries but no daily sums.
alter table public.profiles add column nutrition_mode text not null default 'off'
  check (nutrition_mode in ('off', 'log', 'log_no_totals'));
grant update (nutrition_mode) on public.profiles to authenticated;

-- Food entries can reveal sensitive things (health, religion): they get their own consent.
alter table public.consents drop constraint consents_kind_check;
alter table public.consents add constraint consents_kind_check
  check (kind in ('terms', 'health_data', 'product_mail', 'nutrition'));

-- Turning nutrition on needs an active nutrition consent; revoking it turns nutrition off.
create function public.require_nutrition_consent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.nutrition_mode <> 'off' and not exists (
    select 1 from public.consents
    where user_id = new.id and kind = 'nutrition' and revoked_at is null
  ) then
    raise exception 'nutrition consent required';
  end if;
  return new;
end $$;
create trigger profiles_nutrition_consent before update of nutrition_mode on public.profiles
  for each row when (new.nutrition_mode <> 'off')
  execute function public.require_nutrition_consent();

create function public.consents_revoked_reset_nutrition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'nutrition' then
    update public.profiles set nutrition_mode = 'off' where id = new.user_id;
    -- Withdrawal removes the entries (purged for good by purge_deleted_rows)
    -- and the hints that were derived from them.
    update public.food_logs set deleted_at = now() where user_id = new.user_id and deleted_at is null;
    update public.foods set deleted_at = now() where user_id = new.user_id and deleted_at is null;
    update public.suggestions set deleted_at = now()
      where user_id = new.user_id and deleted_at is null and kind = 'safety' and params ? 'lowIntake';
  end if;
  return new;
end $$;
create trigger consents_revoked_reset_nutrition after update of revoked_at on public.consents
  for each row when (new.revoked_at is not null)
  execute function public.consents_revoked_reset_nutrition();

-- Nutrition rows may only be written while a nutrition consent is active.
-- Soft deletes always go through, so a withdrawal never blocks removing data.
create function public.has_nutrition_consent() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consents
    where user_id = auth.uid() and kind = 'nutrition' and revoked_at is null
  )
$$;
revoke all on function public.has_nutrition_consent() from public, anon;
grant execute on function public.has_nutrition_consent() to authenticated;

create function public.require_nutrition_consent_for_rows() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.deleted_at is null and not public.has_nutrition_consent() then
    raise exception 'nutrition consent required';
  end if;
  return new;
end $$;
create trigger foods_consent before insert or update on public.foods
  for each row execute function public.require_nutrition_consent_for_rows();
create trigger food_logs_consent before insert or update on public.food_logs
  for each row execute function public.require_nutrition_consent_for_rows();

-- Purge also covers the nutrition tables (replaces the function from 20261108).
create or replace function public.purge_deleted_rows(older_than_days integer default 30) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cutoff timestamptz := now() - make_interval(days => older_than_days);
  removed integer := 0;
  n integer;
  t text;
begin
  if older_than_days < 7 then
    raise exception 'refusing to purge rows younger than 7 days';
  end if;
  foreach t in array array['workouts', 'templates', 'workout_exercises', 'template_exercises', 'workout_sets',
                          'checkins', 'bodyweight_entries', 'cycle_events', 'suggestions',
                          'food_logs', 'foods'] loop
    execute format('delete from public.%I where deleted_at is not null and deleted_at < $1', t) using cutoff;
    get diagnostics n = row_count;
    removed := removed + n;
  end loop;
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
