-- Co-hosts for a plan — replaces the earlier plain guest-email-invite step.
-- A co-host is either an existing SHAKE user (status 'active' immediately)
-- or an invited email with no account yet (status 'pending_signup' until
-- they sign up and the client claims the row by matching their new email).
create table if not exists public.plan_cohosts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.user_activities(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'pending_signup')),
  created_at timestamptz not null default now(),
  unique (activity_id, email)
);

alter table public.plan_cohosts enable row level security;

-- Co-host avatars are shown on plan cards to any viewer, not just the creator.
create policy "cohosts are publicly visible"
  on public.plan_cohosts for select
  using (true);

create policy "creator adds cohosts"
  on public.plan_cohosts for insert
  with check (
    exists (select 1 from public.user_activities ua where ua.id = activity_id and ua.user_id = auth.uid())
  );

-- A newly-signed-up invitee claims their own pending_signup row by email match.
create policy "invitee claims their pending cohost invite"
  on public.plan_cohosts for update
  using (status = 'pending_signup' and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (user_id = auth.uid() and status = 'active');

-- Creator can remove any co-host; a co-host can remove themselves (leave).
create policy "creator or cohost removes cohost"
  on public.plan_cohosts for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.user_activities ua where ua.id = activity_id and ua.user_id = auth.uid())
  );

create index if not exists plan_cohosts_activity_id_idx on public.plan_cohosts(activity_id);
create index if not exists plan_cohosts_pending_email_idx on public.plan_cohosts(email) where status = 'pending_signup';
