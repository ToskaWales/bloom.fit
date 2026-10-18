-- Used by the server (service role only) before sending a login code, so that
-- uninvited addresses don't receive mail from us.
create function public.can_request_login(p_email text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from auth.users where lower(email) = lower(p_email))
      or exists (select 1 from public.invites
                  where email = lower(p_email) and redeemed_at is null and expires_at > now());
$$;
revoke all on function public.can_request_login(text) from public, anon, authenticated;
grant execute on function public.can_request_login(text) to service_role;
