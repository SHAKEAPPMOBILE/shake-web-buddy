-- Allow Premium users to create unlimited activities by bypassing the monthly limit
-- We use profiles_private.premium_override as the server-side flag (set by backend logic)

DROP POLICY IF EXISTS "Users can create activities with limit" ON public.user_activities;

CREATE POLICY "Users can create activities (limit or premium)"
ON public.user_activities
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    (
      SELECT count(*)
      FROM public.user_activities ua
      WHERE ua.user_id = auth.uid()
        AND ua.created_at >= date_trunc('month', now())
        AND ua.created_at < (date_trunc('month', now()) + interval '1 mon')
    ) < 10
    OR EXISTS (
      SELECT 1
      FROM public.profiles_private pp
      WHERE pp.user_id = auth.uid()
        AND pp.premium_override = true
    )
  )
);
