-- Who attended a plan (kept after the nightly purge of expired joins), and a record of who a host has
-- already invited so one tap can't ping the same friend twice.

create table if not exists public.plan_attendees (
  activity_id uuid not null references public.user_activities(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);
alter table public.plan_attendees enable row level security;  -- read only through get_event_attendees()

insert into public.plan_attendees (activity_id, user_id, joined_at)
select aj.activity_id, aj.user_id, coalesce(aj.joined_at, now())
from public.activity_joins aj
join public.user_activities ua on ua.id = aj.activity_id and ua.user_id <> aj.user_id
where aj.activity_id is not null
on conflict do nothing;

create or replace function public.track_plan_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.activity_id is not null
       and exists (select 1 from user_activities where id = new.activity_id and user_id <> new.user_id) then
      insert into plan_attendance (activity_id, attendees) values (new.activity_id, 1)
      on conflict (activity_id) do update set attendees = plan_attendance.attendees + 1;
      insert into plan_attendees (activity_id, user_id) values (new.activity_id, new.user_id)
      on conflict do nothing;
    end if;
  elsif tg_op = 'DELETE' then
    -- Only a person leaving (or a plan being cancelled) counts; the nightly purge of expired rows doesn't.
    if old.activity_id is not null and (old.expires_at is null or old.expires_at > now() - interval '1 hour') then
      update plan_attendance set attendees = greatest(attendees - 1, 0) where activity_id = old.activity_id;
      delete from plan_attendees where activity_id = old.activity_id and user_id = old.user_id;
    end if;
  end if;
  return null;
end;
$$;

-- The host's (or an active co-host's) view of who came: name, photo, email and whether they were scanned in.
create or replace function public.get_event_attendees(p_activity_id uuid)
returns table (user_id uuid, name text, avatar_url text, email text, joined_at timestamptz, checked_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not (
    exists (select 1 from user_activities where id = p_activity_id and user_activities.user_id = auth.uid())
    or exists (select 1 from plan_cohosts pc where pc.activity_id = p_activity_id and pc.user_id = auth.uid() and pc.status = 'active')
  ) then
    return;
  end if;
  return query
    select pa.user_id, p.name, p.avatar_url, au.email::text, pa.joined_at, t.checked_in_at
    from plan_attendees pa
    left join profiles p on p.user_id = pa.user_id
    left join auth.users au on au.id = pa.user_id
    left join plan_tickets t on t.activity_id = pa.activity_id and t.user_id = pa.user_id
    where pa.activity_id = p_activity_id
    order by pa.joined_at;
end;
$$;
revoke execute on function public.get_event_attendees(uuid) from public, anon;
grant execute on function public.get_event_attendees(uuid) to authenticated;

create table if not exists public.plan_invitations (
  activity_id uuid not null references public.user_activities(id) on delete cascade,
  user_id uuid not null,
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);
alter table public.plan_invitations enable row level security;  -- written only by the invite-friends-to-plan function
