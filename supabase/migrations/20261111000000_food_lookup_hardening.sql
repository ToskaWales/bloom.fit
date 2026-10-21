-- Hardening of the barcode lookup permission check (20261110).
-- The limits are constants in the function: a caller can no longer choose them.
drop function public.consume_food_lookup(integer, integer);

create function public.consume_food_lookup() returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  mode text;
  q public.food_lookup_quota;
  window_limit constant integer := 20;  -- per ten minutes
  day_limit constant integer := 100;    -- per day
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
revoke all on function public.consume_food_lookup() from public, anon;
grant execute on function public.consume_food_lookup() to authenticated;

-- Same search_path discipline as the other helpers.
create or replace function public.has_nutrition_consent() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.consents
    where user_id = auth.uid() and kind = 'nutrition' and revoked_at is null
  )
$$;
