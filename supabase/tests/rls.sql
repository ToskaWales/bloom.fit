-- RLS-, Constraint- und View-Tests. Läuft mit ON_ERROR_STOP; jede Verletzung bricht ab.
\set ON_ERROR_STOP on
\set a '00000000-0000-0000-0000-00000000000a'
\set b '00000000-0000-0000-0000-00000000000b'

create schema test;
grant usage on schema test to authenticated, anon;

create function test.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;

-- erwartet, dass das SQL scheitert (RLS, Constraint, Berechtigung)
create function test.fails(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok - % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL (kein Fehler): %', label;
end $$;
grant execute on all functions in schema test to authenticated, anon;

-- ------------------------------------------------------------ Setup (als Superuser)
insert into auth.users (id, email) values (:'a', 'a@example.com'), (:'b', 'b@example.com');
select test.ok((select count(*) from public.profiles) = 2, 'Signup-Trigger legt Profile an');
select test.ok((select count(*) from public.exercises where user_id is null) >= 60, 'Übungskatalog geseedet');

-- ------------------------------------------------------------ Nutzerin A schreibt eigene Daten
set role authenticated;
select set_config('request.jwt.claim.sub', :'a', false);

insert into public.cycles (id, user_id, period_start, period_end)
  values ('a0000000-0000-0000-0000-000000000001', :'a', '2026-08-01', '2026-08-05'),
         ('a0000000-0000-0000-0000-000000000002', :'a', '2026-08-29', null);
insert into public.exercises (id, user_id, name) values ('a0000000-0000-0000-0000-0000000000e1', :'a', 'Meine Spezialübung');
insert into public.workouts (id, user_id, performed_on) values ('a0000000-0000-0000-0000-0000000000f1', :'a', '2026-08-10');
insert into public.workout_exercises (id, user_id, workout_id, exercise_id, position)
  values ('a0000000-0000-0000-0000-0000000000f2', :'a', 'a0000000-0000-0000-0000-0000000000f1',
          (select id from public.exercises where user_id is null and name = 'Kniebeuge'), 0);
insert into public.sets (id, user_id, workout_exercise_id, set_index, weight_kg, reps, rpe)
  values ('a0000000-0000-0000-0000-0000000000f3', :'a', 'a0000000-0000-0000-0000-0000000000f2', 0, 80, 5, 8.5);
insert into public.nutrition_entries (id, user_id, logged_on, name, kcal, protein_g, carbs_g, fat_g)
  values ('a0000000-0000-0000-0000-0000000000a1', :'a', '2026-08-10', 'Skyr', 100, 17, 4, 0.2),
         ('a0000000-0000-0000-0000-0000000000a2', :'a', '2026-08-10', 'Haferflocken', 370, 13, 60, 7);
insert into public.daily_checkins (id, user_id, checkin_on, sleep_hours, motivation, energy)
  values ('a0000000-0000-0000-0000-0000000000c1', :'a', '2026-08-10', 7.5, 4, 3);
insert into public.user_consents (user_id, consent_type, version) values (:'a', 'health_data', 'v1');
insert into public.phase_adjustments (id, user_id, phase, factor, basis_cycles)
  values ('a0000000-0000-0000-0000-0000000000d1', :'a', 'luteal', 0.92, 2);
select test.ok(true, 'A kann alle eigenen Daten anlegen');

-- Checkin: Upsert überschreibt statt zu duplizieren
insert into public.daily_checkins (id, user_id, checkin_on, sleep_hours, motivation, energy)
  values ('a0000000-0000-0000-0000-0000000000c2', :'a', '2026-08-10', 6, 2, 2)
  on conflict (user_id, checkin_on) do update set sleep_hours = excluded.sleep_hours,
    motivation = excluded.motivation, energy = excluded.energy;
select test.ok((select count(*) from public.daily_checkins) = 1 and (select motivation from public.daily_checkins) = 2,
  'Check-in Upsert: ein Eintrag pro Tag, überschrieben');
select test.fails($$insert into public.daily_checkins (id, user_id, checkin_on, sleep_hours, motivation, energy)
  values (gen_random_uuid(), current_setting('request.jwt.claim.sub')::uuid, '2026-08-10', 7, 3, 3)$$,
  'Check-in doppelt am selben Tag (ohne Upsert) scheitert');

-- Constraints
select test.fails($$insert into public.cycles (id, user_id, period_start, period_end) values (gen_random_uuid(), current_setting('request.jwt.claim.sub')::uuid, '2026-08-03', '2026-08-07')$$, 'überlappender Zyklus scheitert');
select test.fails($$insert into public.cycles (id, user_id, period_start, period_end) values (gen_random_uuid(), current_setting('request.jwt.claim.sub')::uuid, '2026-09-10', '2026-09-01')$$, 'Periodenende vor Start scheitert');
select test.fails($$update public.sets set rpe = 11$$, 'RPE 11 scheitert');
select test.fails($$update public.sets set rpe = 7.3$$, 'RPE nur in 0,5-Schritten');
select test.fails($$update public.sets set reps = 0$$, 'Wiederholungen 0 scheitert');
select test.fails($$update public.daily_checkins set motivation = 6$$, 'Motivation 6 scheitert');
select test.fails($$update public.daily_checkins set sleep_hours = 25$$, 'Schlaf 25 h scheitert');
select test.fails($$update public.phase_adjustments set status = 'lifted_auto'$$, 'aufgehoben ohne lifted_at scheitert');
update public.sets set rpe = 9 where id = 'a0000000-0000-0000-0000-0000000000f3';
select test.ok(true, 'RPE 9 ok');

-- Profil: Schwangerschaft -> Engine pausiert (E8)
update public.profiles set cycle_context = 'pregnant_or_postpartum' where id = :'a';
select test.ok((select engine_mode from public.profiles where id = :'a') = 'paused', 'Schwangerschaft setzt Engine auf pausiert');
update public.profiles set cycle_context = 'regular', engine_mode = 'adaptive' where id = :'a';

-- Consents: nur Widerruf, kein Löschen, keine Änderung anderer Spalten
update public.user_consents set revoked_at = now();
select test.fails($$update public.user_consents set version = 'v2'$$, 'Consent-Version nicht änderbar');
select test.fails($$delete from public.user_consents$$, 'Consent nicht löschbar');

-- Views
select test.ok((select cycle_day from public.workout_cycle_context) = 10, 'cycle_day = 10 (Tag 10 nach Periodenstart)');
select test.ok((select days_to_next_period from public.workout_cycle_context) = 19, 'days_to_next_period = 19');
select test.ok((select kcal from public.nutrition_daily) = 470, 'nutrition_daily summiert kcal');

-- Export
select test.ok(jsonb_array_length(public.export_my_data()->'workouts') = 1 and jsonb_array_length(public.export_my_data()->'sets') = 1,
  'export_my_data liefert eigene Daten');
select test.ok(jsonb_array_length(public.export_my_data()->'exercises') = 1, 'Export enthält nur eigene (nicht globale) Übungen');

-- user_id nicht umhängbar
select test.fails($$update public.workouts set user_id = '00000000-0000-0000-0000-00000000000b'$$, 'A kann Workout nicht auf B umschreiben');

-- ------------------------------------------------------------ Nutzerin B sieht/ändert nichts von A
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'b', false);

select test.ok((select count(*) from public.cycles) = 0, 'B sieht keine Zyklen von A');
select test.ok((select count(*) from public.workouts) = 0, 'B sieht keine Workouts von A');
select test.ok((select count(*) from public.workout_exercises) = 0, 'B sieht keine Workout-Übungen von A');
select test.ok((select count(*) from public.sets) = 0, 'B sieht keine Sätze von A');
select test.ok((select count(*) from public.nutrition_entries) = 0, 'B sieht keine Ernährung von A');
select test.ok((select count(*) from public.daily_checkins) = 0, 'B sieht keine Check-ins von A');
select test.ok((select count(*) from public.user_consents) = 0, 'B sieht keine Consents von A');
select test.ok((select count(*) from public.phase_adjustments) = 0, 'B sieht keine Anpassungen von A');
select test.ok((select count(*) from public.profiles) = 1, 'B sieht nur das eigene Profil');
select test.ok((select count(*) from public.workout_cycle_context) = 0 and (select count(*) from public.nutrition_daily) = 0,
  'Views zeigen B nichts von A (security_invoker)');
select test.ok(not exists (select 1 from public.exercises where name = 'Meine Spezialübung'), 'B sieht keine eigenen Übungen von A');
select test.ok((select count(*) from public.exercises where user_id is null) >= 60, 'B sieht den globalen Katalog');
select test.ok(jsonb_array_length(public.export_my_data()->'workouts') = 0, 'Export von B enthält nichts von A');

with u as (update public.workouts set notes = 'gehackt' returning 1) select test.ok((select count(*) from u) = 0, 'B kann Workouts von A nicht ändern');
with d as (delete from public.sets returning 1) select test.ok((select count(*) from d) = 0, 'B kann Sätze von A nicht löschen');
with u as (update public.daily_checkins set energy = 1 returning 1) select test.ok((select count(*) from u) = 0, 'B kann Check-ins von A nicht ändern');

select test.fails($$insert into public.workouts (id, user_id, performed_on) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', '2026-08-11')$$, 'B kann nichts im Namen von A anlegen');
select test.fails($$insert into public.workout_exercises (id, user_id, workout_id, exercise_id, position)
  values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-0000000000f1',
  (select id from public.exercises where user_id is null limit 1), 5)$$, 'B kann kein Kind an Workout von A hängen');
select test.fails($$insert into public.workout_exercises (id, user_id, workout_id, exercise_id, position)
  values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', gen_random_uuid(), 'a0000000-0000-0000-0000-0000000000e1', 0)$$, 'B kann keine fremde eigene Übung nutzen / kein Phantom-Parent');
select test.fails($$insert into public.exercises (name, user_id) values ('Global-Hack', null)$$, 'B kann keine globale Übung anlegen');
with u as (update public.exercises set name = 'gehackt' where user_id is null returning 1) select test.ok((select count(*) from u) = 0, 'B kann globale Übungen nicht ändern');
with u as (update public.profiles set engine_mode = 'paused' where id = '00000000-0000-0000-0000-00000000000a' returning 1) select test.ok((select count(*) from u) = 0, 'B kann Profil von A nicht ändern');
select test.fails($$insert into public.profiles (id) values (gen_random_uuid())$$, 'Profile nur per Signup-Trigger anlegbar');
select test.fails($$delete from public.profiles$$, 'Profile nicht per API löschbar');

-- ------------------------------------------------------------ anon hat keinen Zugriff
reset role;
set role anon;
select test.fails($$select * from public.workouts$$, 'anon darf workouts nicht lesen');
select test.fails($$select * from public.profiles$$, 'anon darf profiles nicht lesen');
select test.fails($$select * from public.exercises$$, 'anon darf exercises nicht lesen');
select test.fails($$select public.export_my_data()$$, 'anon darf export_my_data nicht aufrufen');

-- ------------------------------------------------------------ Löschen des Accounts entfernt alle Daten (Cascade)
reset role;
delete from auth.users where id = :'a';
select test.ok(
  (select count(*) from public.workouts) = 0 and (select count(*) from public.sets) = 0
  and (select count(*) from public.cycles) = 0 and (select count(*) from public.nutrition_entries) = 0
  and (select count(*) from public.daily_checkins) = 0 and (select count(*) from public.user_consents) = 0
  and (select count(*) from public.phase_adjustments) = 0 and (select count(*) from public.profiles) = 1
  and not exists (select 1 from public.exercises where name = 'Meine Spezialübung'),
  'Account-Löschung entfernt alle Daten von A (Cascade), B bleibt');

\echo ALLE TESTS BESTANDEN
