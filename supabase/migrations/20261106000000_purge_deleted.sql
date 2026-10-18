-- Soft-deleted rows are kept briefly so deletions reach all devices, then
-- removed for good. Schedule daily (needs the pg_cron extension), e.g.:
--   select cron.schedule('purge-deleted-rows', '0 3 * * *', 'select public.purge_deleted_rows(30)');
create function public.purge_deleted_rows(older_than_days integer default 30) returns integer
language plpgsql security definer set search_path = public as $$
declare
  cutoff timestamptz := now() - make_interval(days => older_than_days);
  removed integer := 0;
  n integer;
  t text;
begin
  if older_than_days < 7 then
    raise exception 'refusing to purge rows younger than 7 days';
  end if;
  -- parents first; their children go with them (on delete cascade)
  foreach t in array array['workouts', 'templates', 'workout_exercises', 'template_exercises', 'workout_sets', 'custom_exercises'] loop
    execute format('delete from public.%I where deleted_at is not null and deleted_at < $1', t) using cutoff;
    get diagnostics n = row_count;
    removed := removed + n;
  end loop;
  return removed;
end $$;
revoke all on function public.purge_deleted_rows(integer) from public, anon, authenticated;
grant execute on function public.purge_deleted_rows(integer) to service_role;
