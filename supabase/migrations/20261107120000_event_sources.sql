-- Event sources: a person connects their own website or calendar, and SHAKE mirrors its upcoming events as plans.
-- Imported plans carry the organizer's own registration link, so sign-ups stay on their website.

create table if not exists public.plan_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  url text not null,
  kind text,                       -- 'ics' | 'jsonld'
  city text,
  tz text,
  active boolean not null default true,
  last_synced_at timestamptz,
  last_status text,
  last_count integer,
  created_at timestamptz not null default now(),
  unique (user_id, url),
  constraint plan_sources_url_https check (url ~* '^https://[^[:space:]]+$' and length(url) <= 1000)
);
alter table public.plan_sources enable row level security;
drop policy if exists "plan_sources_select_own" on public.plan_sources;
create policy "plan_sources_select_own" on public.plan_sources for select to authenticated using (user_id = auth.uid());
drop policy if exists "plan_sources_delete_own" on public.plan_sources;
create policy "plan_sources_delete_own" on public.plan_sources for delete to authenticated using (user_id = auth.uid());
-- Rows are created and updated only by the sync-event-source function.

alter table public.user_activities
  add column if not exists external_url text,
  add column if not exists source_id uuid references public.plan_sources(id) on delete set null,
  add column if not exists external_uid text;

alter table public.user_activities drop constraint if exists user_activities_external_url_https;
alter table public.user_activities
  add constraint user_activities_external_url_https
  check (external_url is null or (external_url ~* '^https://[^[:space:]]+$' and length(external_url) <= 1000));
alter table public.user_activities drop constraint if exists user_activities_source_uid_key;
alter table public.user_activities add constraint user_activities_source_uid_key unique (source_id, external_uid);

-- Imported events don't use up the person's monthly plan allowance.
drop policy if exists "Users can create activities (limit or premium)" on public.user_activities;
create policy "Users can create activities (limit or premium)" on public.user_activities for insert
with check (
  (auth.uid() = user_id) AND (
    (select count(*) from user_activities ua
      where ua.user_id = auth.uid()
        and ua.created_at >= date_trunc('month', now())
        and ua.created_at < (date_trunc('month', now()) + interval '1 mon')
        and ((ua.is_active = true) or (ua.created_at <= (now() - interval '06:00:00')))
        and (ua.is_auto_generated is not true)
        and ua.external_url is null
    ) < get_user_activity_limit(auth.uid())
  )
);
