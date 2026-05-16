-- Add is_current column to venues for explicit rotation pinning.
-- When true, this venue is used as the current rotation pick instead of
-- the automatic week/day modulo fallback.
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;
