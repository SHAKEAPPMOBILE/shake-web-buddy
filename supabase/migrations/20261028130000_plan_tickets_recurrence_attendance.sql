-- Tickets (QR check-in), recurring plans, and a durable attendee count per plan.

-- ── 1. Plan columns ──────────────────────────────────────────────────────────
alter table public.user_activities
  add column if not exists requires_ticket boolean not null default false,
  add column if not exists recurrence text,
  add column if not exists recurrence_tz text,
  add column if not exists recurrence_rolled boolean not null default false;

alter table public.user_activities drop constraint if exists user_activities_recurrence_check;
alter table public.user_activities
  add constraint user_activities_recurrence_check
  check (recurrence is null or recurrence in ('weekly', 'biweekly', 'monthly'));

-- ── 2. Attendance per plan ───────────────────────────────────────────────────
-- activity_joins rows are purged nightly once a plan is over, so a hosting history can't be
-- counted from them. This table is bumped when someone joins and when someone leaves early, and
-- is left alone by the purge (it only deletes rows that expired more than an hour ago).
create table if not exists public.plan_attendance (
  activity_id uuid primary key references public.user_activities(id) on delete cascade,
  attendees integer not null default 0
);
alter table public.plan_attendance enable row level security;
drop policy if exists "plan_attendance_select" on public.plan_attendance;
create policy "plan_attendance_select" on public.plan_attendance for select to authenticated using (true);

insert into public.plan_attendance (activity_id, attendees)
select aj.activity_id, count(*)
from public.activity_joins aj
join public.user_activities ua on ua.id = aj.activity_id and ua.user_id <> aj.user_id
where aj.activity_id is not null
group by aj.activity_id
on conflict (activity_id) do nothing;

create or replace function public.track_plan_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.activity_id is not null
       and exists (select 1 from user_activities where id = new.activity_id and user_id <> new.user_id) then
      insert into plan_attendance (activity_id, attendees) values (new.activity_id, 1)
      on conflict (activity_id) do update set attendees = plan_attendance.attendees + 1;
    end if;
  elsif tg_op = 'DELETE' then
    -- Only a person leaving (or a plan being cancelled) counts; the nightly purge of expired rows doesn't.
    if old.activity_id is not null and (old.expires_at is null or old.expires_at > now() - interval '1 hour') then
      update plan_attendance set attendees = greatest(attendees - 1, 0) where activity_id = old.activity_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_track_plan_attendance on public.activity_joins;
create trigger trg_track_plan_attendance
after insert or delete on public.activity_joins
for each row execute function public.track_plan_attendance();

-- ── 3. Tickets ───────────────────────────────────────────────────────────────
create table if not exists public.plan_tickets (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.user_activities(id) on delete cascade,
  user_id uuid not null,
  code text not null unique,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_in_by uuid,
  unique (activity_id, user_id)
);
alter table public.plan_tickets enable row level security;

-- Read-only from the app: your own tickets, and every ticket of a plan you host or co-host.
-- Tickets are only ever created or checked in by the functions below.
drop policy if exists "plan_tickets_select" on public.plan_tickets;
create policy "plan_tickets_select" on public.plan_tickets for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.user_activities ua where ua.id = plan_tickets.activity_id and ua.user_id = auth.uid())
  or exists (select 1 from public.plan_cohosts pc where pc.activity_id = plan_tickets.activity_id and pc.user_id = auth.uid() and pc.status = 'active')
);

create or replace function public.get_my_ticket(p_activity_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_required boolean;
  v_host uuid;
  v_code text;
  v_checked timestamptz;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  select requires_ticket, user_id into v_required, v_host
    from user_activities where id = p_activity_id and is_active = true;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not v_required then return jsonb_build_object('ok', false, 'reason', 'no_ticket_needed'); end if;
  if v_host = v_uid then return jsonb_build_object('ok', false, 'reason', 'is_host'); end if;
  if not exists (select 1 from activity_joins where activity_id = p_activity_id and user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'not_joined');
  end if;

  insert into plan_tickets (activity_id, user_id, code)
  values (p_activity_id, v_uid, replace(gen_random_uuid()::text, '-', ''))
  on conflict (activity_id, user_id) do nothing;

  select code, checked_in_at into v_code, v_checked
    from plan_tickets where activity_id = p_activity_id and user_id = v_uid;
  return jsonb_build_object('ok', true, 'code', v_code, 'checked_in_at', v_checked);
end;
$$;

create or replace function public.scan_ticket(p_activity_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ticket plan_tickets%rowtype;
  v_name text;
  v_avatar text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'not_signed_in'); end if;
  if not (
    exists (select 1 from user_activities where id = p_activity_id and user_id = v_uid)
    or exists (select 1 from plan_cohosts where activity_id = p_activity_id and user_id = v_uid and status = 'active')
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_host');
  end if;

  select * into v_ticket from plan_tickets where code = trim(p_code);
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if v_ticket.activity_id <> p_activity_id then return jsonb_build_object('ok', false, 'reason', 'wrong_event'); end if;

  select name, avatar_url into v_name, v_avatar from profiles where user_id = v_ticket.user_id;

  -- The "is null" in the where clause makes a double scan lose the race instead of passing twice.
  update plan_tickets set checked_in_at = now(), checked_in_by = v_uid
   where id = v_ticket.id and checked_in_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'already_checked_in', 'name', v_name, 'avatar_url', v_avatar,
                              'checked_in_at', v_ticket.checked_in_at);
  end if;
  return jsonb_build_object('ok', true, 'name', v_name, 'avatar_url', v_avatar);
end;
$$;

revoke execute on function public.get_my_ticket(uuid) from public, anon;
revoke execute on function public.scan_ticket(uuid, text) from public, anon;
grant execute on function public.get_my_ticket(uuid) to authenticated;
grant execute on function public.scan_ticket(uuid, text) to authenticated;

-- ── 4. Recurring plans ───────────────────────────────────────────────────────
-- An hour after a recurring plan starts, the next one is created (same details, next date in the
-- creator's own time zone so a 7pm class stays at 7pm across daylight saving) and the old one is
-- marked as handled. The new plan has its own chat and its own tickets.
create or replace function public.roll_recurring_plans()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_tz text;
  v_step interval;
  v_next timestamptz;
  v_n integer;
  v_count integer := 0;
begin
  for r in
    select * from user_activities
    where is_active = true and recurrence is not null and recurrence_rolled = false
      and scheduled_for < now() - interval '1 hour'
    order by scheduled_for
    limit 200
  loop
    v_tz := coalesce(nullif(r.recurrence_tz, ''), 'UTC');
    begin
      perform now() at time zone v_tz;
    exception when others then
      v_tz := 'UTC';
    end;
    v_step := case r.recurrence when 'weekly' then interval '7 days' when 'biweekly' then interval '14 days' else interval '1 month' end;

    -- First occurrence that is still in the future (counted from the original date, so a monthly plan on
    -- the 31st doesn't drift to the 30th for good).
    v_n := 1;
    loop
      v_next := ((r.scheduled_for at time zone v_tz) + v_step * v_n) at time zone v_tz;
      exit when v_next > now();
      v_n := v_n + 1;
    end loop;

    insert into user_activities (
      user_id, activity_type, city, scheduled_for, note, title, price_amount, price_tiers, capacity, audience,
      venue_name, venue_address, venue_lat, venue_lng, promo_video_url, promo_image_url, promo_video_thumbnail_url,
      description, background_id, requires_ticket, recurrence, recurrence_tz, is_active, is_auto_generated, is_quick_post
    ) values (
      r.user_id, r.activity_type, r.city, v_next, r.note, r.title, r.price_amount, r.price_tiers, r.capacity, r.audience,
      r.venue_name, r.venue_address, r.venue_lat, r.venue_lng, r.promo_video_url, r.promo_image_url, r.promo_video_thumbnail_url,
      r.description, r.background_id, r.requires_ticket, r.recurrence, v_tz, true, false, false
    );

    -- Same row createActivity() adds for the host, expiring at the end of the new plan's day.
    insert into activity_joins (user_id, activity_type, city, expires_at)
    values (
      r.user_id, r.activity_type, r.city,
      (date_trunc('day', v_next at time zone v_tz) + interval '1 day' - interval '1 second') at time zone v_tz
    );

    update user_activities set recurrence_rolled = true where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.roll_recurring_plans() from public, anon, authenticated;

select cron.schedule('roll-recurring-plans', '*/30 * * * *', $$ select public.roll_recurring_plans(); $$);
