-- Funnel-visibility layer for referral links: records a click/visit,
-- separate from the existing referrals table (which only ever records
-- a completed signup). referred_user_id is nullable and reserved for a
-- future conversion step — this migration does not populate it.
create table public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  referred_user_id uuid references auth.users(id) on delete set null,
  session_key text not null,
  created_at timestamptz not null default now(),
  constraint referral_clicks_unique_session unique (referral_code, session_key)
);

create index idx_referral_clicks_referral_code on public.referral_clicks(referral_code);

alter table public.referral_clicks enable row level security;

-- Visitors are anonymous at click time (pre-signup) — same pattern as the
-- existing "Allow anonymous inserts" policy on marketing_joins.
create policy "Allow anonymous inserts" on public.referral_clicks
  for insert
  to public
  with check (true);
