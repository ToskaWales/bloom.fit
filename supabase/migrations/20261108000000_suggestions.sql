-- Suggestions produced by the on-device adaptation engine. Only the kind, day,
-- a few numbers and the user's reaction are stored; the German text is built on
-- the device from these numbers. Same sync model as the other tables.

create table public.suggestions (
  id uuid not null,
  primary key (user_id, id),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('readiness', 'plateau', 'pattern', 'safety', 'hunger_note')),
  day date not null check (day <= current_date + 1),
  subject text not null default '' check (char_length(subject) <= 64), -- e.g. the exercise a plateau is about
  params jsonb not null default '{}'
    check (jsonb_typeof(params) = 'object' and char_length(params::text) <= 2000),
  status text not null default 'shown' check (status in ('shown', 'accepted', 'dismissed')),
  reacted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create unique index suggestions_one_per_subject on public.suggestions (user_id, day, kind, subject) where deleted_at is null;
create index suggestions_pull_idx on public.suggestions (user_id, updated_at);

alter table public.suggestions enable row level security;
revoke all on public.suggestions from anon, authenticated;
grant select, insert, update on public.suggestions to authenticated;
create policy suggestions_select_own on public.suggestions for select to authenticated using (user_id = auth.uid());
create policy suggestions_insert_own on public.suggestions for insert to authenticated
  with check (user_id = auth.uid() and public.has_access());
create policy suggestions_update_own on public.suggestions for update to authenticated
  using (user_id = auth.uid() and public.has_access()) with check (user_id = auth.uid() and public.has_access());
create trigger suggestions_stamp before insert or update on public.suggestions
  for each row execute function public.stamp_row();
