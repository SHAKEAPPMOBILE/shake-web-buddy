-- Lets a proposed plan have a photo instead of (never both) a promo video.
alter table public.user_activities add column if not exists promo_image_url text;

-- Optional longer description shown as a scrollable half-sheet when a plan's
-- title is tapped — separate from `note`, which is the short one-liner.
alter table public.user_activities add column if not exists description text;
