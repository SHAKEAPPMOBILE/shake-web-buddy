-- Fix INSERT policy on user_activities so auto-generated overflow plans
-- (is_auto_generated = true) do not count against the user's monthly plan
-- quota, and so user_id = user.id passes the auth.uid() = user_id check.
--
-- Root cause: useActivityJoins.joinActivity creates auto-generated plans
-- with user_id: user.id (fixed in JS).  The old policy counted every plan
-- the caller owns this month, including those auto-generated rows, which
-- could push them over their limit even though they never created a plan
-- intentionally.  Adding AND (ua.is_auto_generated IS NOT TRUE) excludes
-- those rows so they don't eat into the quota.

DROP POLICY IF EXISTS "Users can create activities (limit or premium)" ON public.user_activities;

CREATE POLICY "Users can create activities (limit or premium)"
  ON public.user_activities
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      SELECT count(*)
        FROM user_activities ua
       WHERE ua.user_id                 = auth.uid()
         AND ua.created_at             >= date_trunc('month', now())
         AND ua.created_at              < date_trunc('month', now()) + INTERVAL '1 month'
         AND (ua.is_active = true OR ua.created_at <= now() - INTERVAL '6 hours')
         AND (ua.is_auto_generated IS NOT TRUE)
    ) < get_user_activity_limit(auth.uid())
  );
