-- Accounts: profiles, consents, invites. Access is invite-only: a profile is
-- created for every auth user, but access_granted_at stays null until the
-- user's email matches an open invite or they redeem an invite code.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  goals text[] not null default '{}'
    check (goals <@ array['muscle', 'recomp', 'strength']::text[]),
  training_days smallint check (training_days between 1 and 7),
  experience text check (experience in ('lt1y', '1to3y', 'gt3y')),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  cycle_mode text check (cycle_mode in ('natural', 'hormonal', 'irregular', 'none')),
  last_period_start date,
  start_weight_kg numeric(5, 2) check (start_weight_kg between 30 and 300),
  basics_completed_at timestamptz,
  onboarding_completed_at timestamptz,
  access_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('terms', 'health_data', 'product_mail')),
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- One active (non-revoked) consent per kind.
create unique index consents_active_idx on public.consents (user_id, kind) where revoked_at is null;

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text check (email is null or email = lower(email)),
  code_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz
);
create index invites_email_idx on public.invites (email) where redeemed_at is null;

alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.invites enable row level security;

-- Table-level grants are narrowed to exactly what the client may do.
revoke all on public.profiles, public.consents, public.invites from anon, authenticated;

-- Invite gate in the database: without access, a signed-in user (e.g. via
-- Google/Apple) cannot write anything through the API.
create function public.has_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and access_granted_at is not null);
$$;
revoke all on function public.has_access() from public, anon;
grant execute on function public.has_access() to authenticated;

grant select on public.profiles to authenticated;
grant update (goals, training_days, experience, units, cycle_mode, last_period_start,
              start_weight_kg, basics_completed_at, onboarding_completed_at) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and public.has_access())
  with check (id = auth.uid() and public.has_access());

-- Consents: granted_at/revoked_at are never client-writable.
grant select on public.consents to authenticated;
grant insert (user_id, kind, version) on public.consents to authenticated;
grant update (revoked_at) on public.consents to authenticated;
create policy consents_select_own on public.consents for select to authenticated
  using (user_id = auth.uid());
create policy consents_insert_own on public.consents for insert to authenticated
  with check (user_id = auth.uid() and public.has_access());
create policy consents_revoke_own on public.consents for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A revocation is final and timestamped by the server.
create function public.consents_revoke_only() returns trigger language plpgsql as $$
begin
  if old.revoked_at is not null then
    raise exception 'consent already revoked';
  end if;
  new.revoked_at = now();
  return new;
end $$;
create trigger consents_revoke_only before update on public.consents
  for each row execute function public.consents_revoke_only();

-- Revoking terms or health-data consent ends onboarding, so the app stops
-- processing health data until the user consents again.
create function public.consents_revoked_reset_onboarding() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind in ('terms', 'health_data') then
    update public.profiles set onboarding_completed_at = null where id = new.user_id;
  end if;
  return new;
end $$;
create trigger consents_revoked_reset after update of revoked_at on public.consents
  for each row when (new.revoked_at is not null)
  execute function public.consents_revoked_reset_onboarding();
-- invites: no policies, no grants for anon/authenticated -> service role only.

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Onboarding may only be completed with a filled profile and active
-- terms + health-data consent (also holds for direct API calls).
create function public.require_consents_for_onboarding() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.onboarding_completed_at is not null and old.onboarding_completed_at is null then
    if cardinality(new.goals) = 0 or new.training_days is null or new.experience is null
       or new.cycle_mode is null or new.basics_completed_at is null then
      raise exception 'profile incomplete: finish all onboarding steps first';
    end if;
    if (select count(distinct kind) from public.consents
          where user_id = new.id and revoked_at is null and kind in ('terms', 'health_data')) < 2 then
      raise exception 'consent required: terms and health_data must be granted';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_require_consents before update on public.profiles
  for each row execute function public.require_consents_for_onboarding();

-- Grants access if an open invite matches the (verified) email.
create function public.grant_access_for_email(p_user uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  invite_id uuid;
begin
  select id into invite_id from public.invites
    where email = lower(p_email) and redeemed_at is null and expires_at > now()
    order by created_at limit 1
    for update;
  if invite_id is null then
    return;
  end if;
  update public.profiles set access_granted_at = coalesce(access_granted_at, now()) where id = p_user;
  update public.invites set redeemed_by = p_user, redeemed_at = now() where id = invite_id;
end $$;
revoke all on function public.grant_access_for_email(uuid, text) from public, anon, authenticated;

-- New auth user -> profile. Access is only auto-granted once the email is verified.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  if new.email_confirmed_at is not null and new.email is not null then
    perform public.grant_access_for_email(new.id, new.email);
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null then
    perform public.grant_access_for_email(new.id, new.email);
  end if;
  return new;
end $$;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();

-- Redeem a single-use invite code for the calling user.
create function public.redeem_invite(code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  invite_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and access_granted_at is not null) then
    return false; -- already has access: don't burn the code
  end if;
  select id into invite_id from public.invites
    where code_hash = encode(sha256(convert_to(code, 'UTF8')), 'hex')
      and redeemed_at is null and expires_at > now()
    for update;
  if invite_id is null then
    return false;
  end if;
  update public.invites set redeemed_by = auth.uid(), redeemed_at = now() where id = invite_id;
  update public.profiles set access_granted_at = now() where id = auth.uid();
  return true;
end $$;
revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;
