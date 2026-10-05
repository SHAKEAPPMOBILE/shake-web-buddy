-- +5 points when someone is physically at a plan they joined (or host).
--
-- Points already flow through check_ins: get_user_points() sums check_ins.points_earned,
-- so a plan check-in only has to insert a row there. What's new is that the row is created
-- by the database after it has checked everything itself, instead of trusting the app.
--
-- A check-in counts when ALL of these hold:
--   * the person is the plan's host or joined it (activity_joins)
--   * the plan has a pinned location (venue_lat / venue_lng — set when the host picked a place)
--   * now is between 1 hour before and 4 hours after the plan's start time
--   * at least two people are in the plan (host + one more), so nobody can farm points by
--     hosting a plan for themselves at home
--   * the reported position is within 150 m of the plan's location
--   * they haven't already been awarded for this plan (once per person per plan)
--
-- The position still comes from the phone, so a determined person could fake GPS. The rules
-- above (time window, real other person, once per plan) keep that from being worth much.

alter table public.check_ins
  add column if not exists activity_id uuid;   -- the plan this check-in was for; null for venue check-ins

-- The one-per-day rule was written for venue check-ins; keep it for those only, so a person can
-- go to two different plans of the same type in one day and be counted for each.
drop index if exists public.idx_unique_daily_checkin;
create unique index if not exists idx_unique_daily_checkin
  on public.check_ins (user_id, activity_type, city, check_in_date)
  where activity_id is null;

create unique index if not exists idx_unique_plan_checkin
  on public.check_ins (user_id, activity_id)
  where activity_id is not null;

-- Until now any signed-in person could insert a check_ins row with any points_earned. Plan
-- check-ins can only be written by check_in_to_plan() below (security definer bypasses RLS),
-- and direct inserts are limited to the app's existing +5 venue check-in.
drop policy if exists "Users can create their own check-ins" on public.check_ins;
create policy "Users can create their own check-ins"
  on public.check_ins for insert
  with check (auth.uid() = user_id and points_earned = 5 and activity_id is null);

create or replace function public.check_in_to_plan(
  p_activity_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  plan record;
  people int;
  dist_m double precision;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then
    return jsonb_build_object('ok', false, 'reason', 'bad_location');
  end if;

  select id, user_id, activity_type, city, venue_name, venue_lat, venue_lng, scheduled_for, is_active
    into plan
    from public.user_activities
   where id = p_activity_id;

  if not found or not plan.is_active then
    return jsonb_build_object('ok', false, 'reason', 'plan_not_found');
  end if;
  if plan.venue_lat is null or plan.venue_lng is null then
    return jsonb_build_object('ok', false, 'reason', 'no_plan_location');
  end if;
  if now() < plan.scheduled_for - interval '1 hour' or now() > plan.scheduled_for + interval '4 hours' then
    return jsonb_build_object('ok', false, 'reason', 'outside_time_window');
  end if;

  if plan.user_id <> uid and not exists (
    select 1 from public.activity_joins aj where aj.activity_id = p_activity_id and aj.user_id = uid
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_a_participant');
  end if;

  select count(*) into people from (
    select plan.user_id as u
    union
    select aj.user_id from public.activity_joins aj where aj.activity_id = p_activity_id
  ) x;
  if people < 2 then
    return jsonb_build_object('ok', false, 'reason', 'needs_another_person');
  end if;

  -- Great-circle distance (haversine), metres.
  dist_m := 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat - plan.venue_lat) / 2), 2)
    + cos(radians(plan.venue_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - plan.venue_lng) / 2), 2)
  ));
  if dist_m > 150 then
    return jsonb_build_object('ok', false, 'reason', 'too_far', 'distance_m', round(dist_m));
  end if;

  insert into public.check_ins (user_id, activity_type, city, venue_name, points_earned, check_in_date, activity_id)
  values (uid, plan.activity_type, plan.city, coalesce(nullif(plan.venue_name, ''), plan.city), 5, current_date, p_activity_id)
  on conflict (user_id, activity_id) where activity_id is not null do nothing;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'already_checked_in');
  end if;

  return jsonb_build_object('ok', true, 'points', 5, 'venue_name', coalesce(nullif(plan.venue_name, ''), plan.city));
end;
$$;

revoke all on function public.check_in_to_plan(uuid, double precision, double precision) from public, anon;
grant execute on function public.check_in_to_plan(uuid, double precision, double precision) to authenticated;

-- The plans this person could be checked in to right now: theirs (hosted or joined), pinned to a
-- place, inside the time window, not yet awarded. The app asks for this so it only has to read
-- the phone's location when there is actually something to check in to.
create or replace function public.get_my_checkin_candidates()
returns table (
  activity_id uuid,
  venue_name text,
  venue_lat double precision,
  venue_lng double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select ua.id, coalesce(nullif(ua.venue_name, ''), ua.city), ua.venue_lat, ua.venue_lng
    from public.user_activities ua
   where auth.uid() is not null
     and ua.is_active
     and ua.venue_lat is not null and ua.venue_lng is not null
     and now() between ua.scheduled_for - interval '1 hour' and ua.scheduled_for + interval '4 hours'
     and (ua.user_id = auth.uid()
          or exists (select 1 from public.activity_joins aj where aj.activity_id = ua.id and aj.user_id = auth.uid()))
     and not exists (select 1 from public.check_ins ci where ci.user_id = auth.uid() and ci.activity_id = ua.id)
$$;

revoke all on function public.get_my_checkin_candidates() from public, anon;
grant execute on function public.get_my_checkin_candidates() to authenticated;
