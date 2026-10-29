-- "Attending": the events a person joined, and who else was there (names and photos only, never emails).

create or replace function public.my_attended_events()
returns table (
  activity_id uuid, activity_type text, note text, city text, scheduled_for timestamptz,
  host_id uuid, host_name text, host_avatar text, attendees integer
)
language sql security definer set search_path = public as $$
  select ua.id, ua.activity_type, ua.note, ua.city, ua.scheduled_for,
         ua.user_id, hp.name, hp.avatar_url, coalesce(pat.attendees, 0)
  from plan_attendees pa
  join user_activities ua on ua.id = pa.activity_id
  left join profiles hp on hp.user_id = ua.user_id
  left join plan_attendance pat on pat.activity_id = ua.id
  where pa.user_id = auth.uid()
  order by ua.scheduled_for desc
$$;

-- Only someone who attended the event can see who else did. The host comes along as a flagged row.
create or replace function public.get_attended_event_people(p_activity_id uuid)
returns table (user_id uuid, name text, avatar_url text, is_host boolean)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from plan_attendees where activity_id = p_activity_id and plan_attendees.user_id = auth.uid()
  ) then
    return;
  end if;
  return query
    select ua.user_id, p.name, p.avatar_url, true
    from user_activities ua left join profiles p on p.user_id = ua.user_id
    where ua.id = p_activity_id
    union all
    select pa.user_id, p.name, p.avatar_url, false
    from plan_attendees pa left join profiles p on p.user_id = pa.user_id
    where pa.activity_id = p_activity_id;
end;
$$;

revoke execute on function public.my_attended_events() from public, anon;
revoke execute on function public.get_attended_event_people(uuid) from public, anon;
grant execute on function public.my_attended_events() to authenticated;
grant execute on function public.get_attended_event_people(uuid) to authenticated;
