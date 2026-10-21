-- Beta metrics for the validation phase. Run in the Supabase SQL editor (it has
-- full access). Counts only: no health values, no names, no e-mail addresses.
-- Each row is one metric; "n" is the numerator, "of" the denominator.
-- "Activity day" = a day with a check-in, a finished workout or a food entry.

with members as (
  select id, access_granted_at, cycle_mode, nutrition_mode
  from public.profiles
  where access_granted_at is not null
),
activity as (
  select user_id, day from public.checkins where deleted_at is null
  union
  select user_id, (started_at at time zone 'UTC')::date from public.workouts
    where deleted_at is null and ended_at is not null
  union
  select user_id, day from public.food_logs where deleted_at is null
),
per_member as (
  select
    m.id,
    m.access_granted_at,
    -- activity days in the first 14 days after getting access
    count(distinct a.day) filter (
      where a.day >= m.access_granted_at::date and a.day < m.access_granted_at::date + 14
    ) as days_first_14,
    -- any activity in days 22-28 (retention in week four)
    bool_or(a.day >= m.access_granted_at::date + 21 and a.day < m.access_granted_at::date + 28) as active_week_4
  from members m
  left join activity a on a.user_id = m.id
  group by m.id, m.access_granted_at
)
select 'members with access' as metric, count(*)::int as n, count(*)::int as "of" from per_member
union all
select 'activated: 7+ activity days in the first 14',
  count(*) filter (where days_first_14 >= 7)::int,
  count(*) filter (where access_granted_at <= now() - interval '14 days')::int
from per_member
union all
select 'retained: active in week 4',
  count(*) filter (where coalesce(active_week_4, false))::int,
  count(*) filter (where access_granted_at <= now() - interval '28 days')::int
from per_member
union all
select 'tracks cycle (natural or irregular)',
  count(*) filter (where cycle_mode in ('natural', 'irregular'))::int, count(*)::int
from members
union all
select 'nutrition switched on',
  count(*) filter (where nutrition_mode <> 'off')::int, count(*)::int
from members
union all
select 'hints accepted: ' || kind,
  count(*) filter (where status = 'accepted')::int, count(*)::int
from public.suggestions where deleted_at is null group by kind
union all
select 'hints dismissed: ' || kind,
  count(*) filter (where status = 'dismissed')::int, count(*)::int
from public.suggestions where deleted_at is null group by kind
order by 1;
