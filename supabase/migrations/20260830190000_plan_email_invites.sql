-- Email invites to a specific plan. A creator adds emails; each gets a
-- Postmark email pointing at the plan's existing /invite/:activityId
-- landing page. Redemption (landing on the right plan post-signup/login)
-- is handled client-side via localStorage — see useReferralTracking for
-- the exact same pattern applied to referral codes.
create table if not exists public.plan_email_invites (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.user_activities(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists plan_email_invites_email_idx on public.plan_email_invites (lower(email));
create index if not exists plan_email_invites_activity_idx on public.plan_email_invites (activity_id);

alter table public.plan_email_invites enable row level security;

create policy "creator manages own plan invites" on public.plan_email_invites
  for all to authenticated
  using (invited_by = auth.uid())
  with check (invited_by = auth.uid());
