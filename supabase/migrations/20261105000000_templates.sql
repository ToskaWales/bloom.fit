-- Workout templates: reusable sessions ("Push A"). Same sync model as the
-- training log (client ids, server-stamped updated_at, soft delete).

create table public.templates (
  id uuid not null,
  primary key (user_id, id), -- ids are only unique per user: nobody can squat or probe another user's ids
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.template_exercises (
  id uuid not null,
  primary key (user_id, id), -- ids are only unique per user: nobody can squat or probe another user's ids
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null,
  exercise_id text not null check (char_length(exercise_id) between 1 and 64),
  position integer not null check (position >= 0),
  set_count smallint not null default 3 check (set_count between 1 and 20),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  foreign key (template_id, user_id) references public.templates (id, user_id) on delete cascade
);

create index templates_pull_idx on public.templates (user_id, updated_at);
create index template_exercises_pull_idx on public.template_exercises (user_id, updated_at);

do $$
declare
  t text;
begin
  foreach t in array array['templates', 'template_exercises'] loop
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
