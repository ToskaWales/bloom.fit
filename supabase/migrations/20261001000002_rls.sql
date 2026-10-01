-- Row-Level-Security: jede Nutzerin sieht und ändert ausschließlich ihre eigenen Daten.

-- Grundsätzlich kein Zugriff für anon; angemeldete Nutzerinnen nur über RLS.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Supabase vergibt auf neue Tabellen standardmäßig alle Rechte an authenticated. Wir starten bei null
-- und vergeben unten pro Tabelle nur, was gebraucht wird (Defense in Depth zusätzlich zu RLS).
revoke all on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from authenticated;

-- ---------------------------------------------------------------- Standard-Tabellen (CRUD auf eigene Zeilen)
do $$
declare t text;
begin
  foreach t in array array[
    'cycles', 'workouts', 'nutrition_entries', 'daily_checkins', 'phase_adjustments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- profiles (Anlage nur per Trigger, kein Delete)
alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------- user_consents (Nachweis: kein Delete, nur Widerruf)
alter table public.user_consents enable row level security;
grant select, insert on public.user_consents to authenticated;
grant update (revoked_at) on public.user_consents to authenticated;
create policy user_consents_select_own on public.user_consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_consents_insert_own on public.user_consents for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_consents_update_own on public.user_consents for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- exercises (global lesbar, eigene schreibbar)
alter table public.exercises enable row level security;
grant select, insert, update, delete on public.exercises to authenticated;
create policy exercises_select on public.exercises for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy exercises_insert_own on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy exercises_update_own on public.exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exercises_delete_own on public.exercises for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- Kindtabellen
-- Gleicher Besitzer wie der Parent ist zusätzlich per zusammengesetztem Fremdschlüssel erzwungen.
alter table public.workout_exercises enable row level security;
grant select, insert, update, delete on public.workout_exercises to authenticated;
create policy workout_exercises_select_own on public.workout_exercises for select to authenticated
  using (user_id = (select auth.uid()));
create policy workout_exercises_insert_own on public.workout_exercises for insert to authenticated
  with check (
    user_id = (select auth.uid())
    -- Übung muss global oder eigene sein (die Select-Policy auf exercises greift in der Unterabfrage)
    and exists (select 1 from public.exercises e where e.id = exercise_id)
  );
create policy workout_exercises_update_own on public.workout_exercises for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id)
  );
create policy workout_exercises_delete_own on public.workout_exercises for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.sets enable row level security;
grant select, insert, update, delete on public.sets to authenticated;
create policy sets_select_own on public.sets for select to authenticated
  using (user_id = (select auth.uid()));
create policy sets_insert_own on public.sets for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy sets_update_own on public.sets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy sets_delete_own on public.sets for delete to authenticated
  using (user_id = (select auth.uid()));
