-- "Post like this" — a plan created straight from the captured video/photo
-- with no title or other fields, shown in the discovery feed for 24h from
-- posting instead of the normal 3h-after-start window (see isActivityVisible
-- in PlansTab.tsx). Flag mirrors is_auto_generated's existing pattern.
alter table public.user_activities
  add column if not exists is_quick_post boolean not null default false;
