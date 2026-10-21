-- Barcode lookups (Open Food Facts) and the barcode index.
--
-- 1) One food per barcode is no longer enforced by the database: two offline
--    devices saving the same product, or delete + re-add arriving in a different
--    order, would be rejected for good. Duplicates are harmless (log entries
--    carry their own copy of the values); the app avoids them by looking up the
--    local barcode first.
drop index public.foods_one_per_barcode;
create index foods_barcode_idx on public.foods (user_id, barcode) where deleted_at is null and barcode is not null;

-- 2) Rate limit and permission for the lookup route, decided in the database:
--    needs access, nutrition switched on and an active consent. No barcode is stored.
create table public.food_lookup_quota (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null default now(),
  window_count integer not null default 0,
  day_start timestamptz not null default now(),
  day_count integer not null default 0
);
alter table public.food_lookup_quota enable row level security;
revoke all on public.food_lookup_quota from anon, authenticated;

create function public.consume_food_lookup(
  window_limit integer default 20,
  day_limit integer default 100
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  mode text;
  q public.food_lookup_quota;
begin
  if uid is null or not public.has_access() or not public.has_nutrition_consent() then
    return 'not_allowed';
  end if;
  select nutrition_mode into mode from public.profiles where id = uid;
  if mode is null or mode = 'off' then
    return 'not_allowed';
  end if;

  insert into public.food_lookup_quota as t (user_id, window_start, window_count, day_start, day_count)
  values (uid, now(), 1, now(), 1)
  on conflict (user_id) do update set
    window_count = case when t.window_start < now() - interval '10 minutes' then 1 else t.window_count + 1 end,
    window_start = case when t.window_start < now() - interval '10 minutes' then now() else t.window_start end,
    day_count = case when t.day_start < now() - interval '1 day' then 1 else t.day_count + 1 end,
    day_start = case when t.day_start < now() - interval '1 day' then now() else t.day_start end
  returning * into q;

  if q.window_count > window_limit or q.day_count > day_limit then
    return 'limited';
  end if;
  return 'ok';
end $$;
revoke all on function public.consume_food_lookup(integer, integer) from public, anon;
grant execute on function public.consume_food_lookup(integer, integer) to authenticated;
