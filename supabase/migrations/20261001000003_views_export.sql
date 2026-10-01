-- Views (security_invoker -> RLS der Aufruferin gilt) und Datenexport.

create view public.nutrition_daily with (security_invoker = true) as
select
  user_id,
  logged_on,
  sum(kcal) as kcal,
  sum(protein_g) as protein_g,
  sum(carbs_g) as carbs_g,
  sum(fat_g) as fat_g
from public.nutrition_entries
group by user_id, logged_on;

-- Zyklus-Kontext je Training. Die Phase selbst berechnet die Engine (src/engine/cyclePhase.ts);
-- hier nur Rohwerte, damit nachträgliche Korrekturen von Perioden nie veraltete Daten hinterlassen.
create view public.workout_cycle_context with (security_invoker = true) as
select
  w.id as workout_id,
  w.user_id,
  w.performed_on,
  c.id as cycle_id,
  c.period_start,
  (w.performed_on - c.period_start + 1) as cycle_day,
  n.next_period_start,
  (n.next_period_start - w.performed_on) as days_to_next_period
from public.workouts w
left join lateral (
  select c1.id, c1.period_start
  from public.cycles c1
  where c1.user_id = w.user_id and c1.period_start <= w.performed_on
  order by c1.period_start desc
  limit 1
) c on true
left join lateral (
  select min(c2.period_start) as next_period_start
  from public.cycles c2
  where c2.user_id = w.user_id and c2.period_start > w.performed_on
) n on true
where w.deleted_at is null;

revoke all on public.nutrition_daily, public.workout_cycle_context from anon, authenticated;
grant select on public.nutrition_daily, public.workout_cycle_context to authenticated;

-- Datenexport (DSGVO Art. 20): alle eigenen Daten als JSON. security invoker -> nur eigene Zeilen.
create function public.export_my_data() returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p limit 1),
    'consents', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_consents t), '[]'),
    'cycles', coalesce((select jsonb_agg(to_jsonb(t)) from public.cycles t), '[]'),
    'exercises', coalesce((select jsonb_agg(to_jsonb(t)) from public.exercises t where t.user_id is not null), '[]'),
    'workouts', coalesce((select jsonb_agg(to_jsonb(t)) from public.workouts t), '[]'),
    'workout_exercises', coalesce((select jsonb_agg(to_jsonb(t)) from public.workout_exercises t), '[]'),
    'sets', coalesce((select jsonb_agg(to_jsonb(t)) from public.sets t), '[]'),
    'nutrition_entries', coalesce((select jsonb_agg(to_jsonb(t)) from public.nutrition_entries t), '[]'),
    'daily_checkins', coalesce((select jsonb_agg(to_jsonb(t)) from public.daily_checkins t), '[]'),
    'phase_adjustments', coalesce((select jsonb_agg(to_jsonb(t)) from public.phase_adjustments t), '[]')
  );
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
