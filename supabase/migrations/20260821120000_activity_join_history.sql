-- activity_joins is deliberately ephemeral — a nightly cron job purges rows
-- once a plan's scheduled_for + 24h passes (or a carousel join's expires_at
-- passes), so the app's "am I already joined" check stays fast. That means
-- it was never a valid source for historical reporting, and everything
-- before this migration has already been permanently deleted by that job.
--
-- This table is the fix: insert-only, never purged, written by a trigger so
-- every future join is preserved regardless of what later happens to the
-- source row.
create table public.activity_join_history (
  id uuid primary key default gen_random_uuid(),
  join_id uuid not null,
  user_id uuid not null,
  activity_id uuid,
  activity_type text,
  city text,
  joined_at timestamptz not null,
  logged_at timestamptz not null default now()
);

create index idx_activity_join_history_joined_at on public.activity_join_history(joined_at);
create index idx_activity_join_history_city on public.activity_join_history(city);
create index idx_activity_join_history_activity_type on public.activity_join_history(activity_type);

alter table public.activity_join_history enable row level security;
-- No policies: only the trigger (SECURITY DEFINER, runs as table owner) and
-- the admin edge function (service role) ever touch this table.

create or replace function public.log_activity_join_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_join_history (join_id, user_id, activity_id, activity_type, city, joined_at)
  values (new.id, new.user_id, new.activity_id, new.activity_type, new.city, new.joined_at);
  return new;
end;
$$;

drop trigger if exists trg_log_activity_join_history on public.activity_joins;
create trigger trg_log_activity_join_history
  after insert on public.activity_joins
  for each row execute function public.log_activity_join_history();

-- Backfill: preserve the handful of rows still alive right now before
-- tonight's 03:00 UTC purge deletes them too.
insert into public.activity_join_history (join_id, user_id, activity_id, activity_type, city, joined_at)
select id, user_id, activity_id, activity_type, city, joined_at
from public.activity_joins
on conflict do nothing;
