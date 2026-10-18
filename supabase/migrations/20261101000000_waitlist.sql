-- Waitlist for pre-launch validation. Accessed only server-side via the
-- service-role key; RLS is enabled with no policies so anon/authenticated
-- clients cannot read or write anything.
create table public.waitlist (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  variant text not null check (variant in ('a', 'b', 'c')),
  source text check (source is null or char_length(source) <= 64),
  token_hash text not null,
  token_sent_at timestamptz not null,
  consent_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index waitlist_token_hash_idx on public.waitlist (token_hash);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
