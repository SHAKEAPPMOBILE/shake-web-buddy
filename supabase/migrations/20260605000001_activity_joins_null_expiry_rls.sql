-- Fix RLS policy on activity_joins to allow rows where expires_at IS NULL.
-- Carousel joins (open-ended group interest) have expires_at = NULL, meaning
-- the previous policy (expires_at > now()) blocked ALL of them, making the
-- All Cities tab return no groups. Rows are valid if they never expire OR
-- their expiry is in the future.
DROP POLICY IF EXISTS "Authenticated users can view active activity joins" ON public.activity_joins;

CREATE POLICY "Authenticated users can view active activity joins"
ON public.activity_joins
FOR SELECT
TO authenticated
USING (expires_at IS NULL OR expires_at > now());
