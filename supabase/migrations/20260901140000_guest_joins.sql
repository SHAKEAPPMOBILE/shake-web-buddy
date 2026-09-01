-- Lets a non-user "join" a free, everyone-audience plan via an invite link
-- without creating an account — capped at 2 per email, enforced server-side
-- in the guest-join-plan edge function. No public RLS policies: every read
-- and write goes through a service-role edge function (get-guest-join /
-- guest-join-plan / claim-guest-joins) so guest emails are never exposed via
-- the anon key.
create table if not exists public.guest_joins (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid(),
  -- join_key disambiguates a real plan (its id) from a carousel/category
  -- activity (which has no single stable row) so the same email can't
  -- double-join either kind, without the two kinds colliding with each other.
  join_key text not null,
  activity_id uuid references public.user_activities(id) on delete cascade,
  activity_type text not null,
  city text not null,
  scheduled_for timestamptz,
  email text not null,
  name text,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (join_key, email),
  unique (token)
);

alter table public.guest_joins enable row level security;

create index if not exists guest_joins_email_idx on public.guest_joins(lower(email));
create index if not exists guest_joins_activity_id_idx on public.guest_joins(activity_id);
