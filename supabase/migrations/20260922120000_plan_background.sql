-- Lets a plan creator pick a preset background gradient for their plan,
-- shown behind the profile picture in the swipe feed (when there's no promo
-- photo/video) and in the plan's chat header. Null means no preset chosen —
-- every surface falls back to its existing default look.
alter table public.user_activities add column if not exists background_id text;
