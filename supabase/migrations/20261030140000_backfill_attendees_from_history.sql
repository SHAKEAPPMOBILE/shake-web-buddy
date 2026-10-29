-- plan_attendees only started recording recently, but joins were always logged elsewhere. Rebuild the past
-- from the permanent join log, from paid joins, and from anyone who posted in the plan's chat.

insert into public.plan_attendees (activity_id, user_id, joined_at)
select h.activity_id, h.user_id, min(h.joined_at)
from public.activity_join_history h
join public.user_activities ua on ua.id = h.activity_id and ua.user_id <> h.user_id
where h.activity_id is not null
group by h.activity_id, h.user_id
on conflict do nothing;

insert into public.plan_attendees (activity_id, user_id, joined_at)
select pp.activity_id, pp.payer_user_id, min(pp.paid_at)
from public.plan_payments pp
join public.user_activities ua on ua.id = pp.activity_id and ua.user_id <> pp.payer_user_id
where pp.activity_id is not null and pp.payer_user_id is not null
group by pp.activity_id, pp.payer_user_id
on conflict do nothing;

insert into public.plan_attendees (activity_id, user_id, joined_at)
select pm.activity_id, pm.user_id, min(pm.created_at)
from public.plan_messages pm
join public.user_activities ua on ua.id = pm.activity_id and ua.user_id <> pm.user_id
group by pm.activity_id, pm.user_id
on conflict do nothing;

-- Keep the per-plan counts in step with the rebuilt list.
insert into public.plan_attendance (activity_id, attendees)
select activity_id, count(*) from public.plan_attendees group by activity_id
on conflict (activity_id) do update set attendees = greatest(plan_attendance.attendees, excluded.attendees);
