-- Allow users to resubmit after rejection by permitting UPDATE when current status is pending OR rejected,
-- while still preventing users from modifying approved verifications.

DROP POLICY IF EXISTS "Users can update their pending verification" ON public.creator_verifications;

CREATE POLICY "Users can update their verification (pending or rejected)"
ON public.creator_verifications
FOR UPDATE
USING (
  auth.uid() = user_id
  AND status IN ('pending', 'rejected')
)
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('pending', 'rejected')
);
