-- A static frame captured client-side from a plan's promo video, used only
-- for the WhatsApp/social share preview image — og:image can't embed a
-- playing video, and there's no server-side video-processing step to pull
-- a frame from promo_video_url itself.
alter table public.user_activities add column if not exists promo_video_thumbnail_url text;
