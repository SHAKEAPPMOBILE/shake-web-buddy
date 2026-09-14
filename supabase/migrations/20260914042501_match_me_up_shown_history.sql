-- Tracks who "Match me up" has already shown each user, so tapping it again
-- advances through the ranked list of compatible people instead of
-- re-showing the same top match every time. Persists across sessions/
-- devices (not just client-side state) so the "whole matching pool" really
-- does get exhausted over time rather than resetting on app restart.
create table if not exists public.match_me_up_shown (
  user_id uuid not null references auth.users(id) on delete cascade,
  shown_user_id uuid not null references auth.users(id) on delete cascade,
  shown_at timestamp with time zone not null default now(),
  primary key (user_id, shown_user_id)
);

alter table public.match_me_up_shown enable row level security;

-- Only the edge function (service role) reads/writes this — no client access.
create policy "service role only" on public.match_me_up_shown
  for all
  using (false)
  with check (false);
