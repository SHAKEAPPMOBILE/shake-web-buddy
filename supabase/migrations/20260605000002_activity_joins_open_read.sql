-- 91 of 97 activity_join rows have expires_at in the past, so the previous
-- policy (expires_at IS NULL OR expires_at > now()) was silently returning
-- only 6 rows to authenticated users. All Cities tab showed nothing.
-- Reads are safe to open to all authenticated users — writes are still
-- restricted to the row owner via separate INSERT/DELETE policies.
DROP POLICY IF EXISTS "Authenticated users can view active activity joins" ON public.activity_joins;
DROP POLICY IF EXISTS "activity_joins_select" ON public.activity_joins;

CREATE POLICY "activity_joins_select"
ON public.activity_joins
FOR SELECT
TO authenticated
USING (true);
