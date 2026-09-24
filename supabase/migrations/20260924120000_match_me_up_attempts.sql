-- One row per shake/"Match me up" attempt, so find-interest-match can rotate
-- between people already shown (never messaged) and fresh batches per month.
create table if not exists public.match_me_up_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  shown_user_id uuid,
  kind text not null check (kind in ('old', 'new', 'none')),
  created_at timestamptz not null default now()
);
create index if not exists match_me_up_attempts_user_created_idx
  on public.match_me_up_attempts (user_id, created_at desc);
alter table public.match_me_up_attempts enable row level security;
create policy "service role only" on public.match_me_up_attempts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
