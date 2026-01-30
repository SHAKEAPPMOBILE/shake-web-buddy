-- Drop the old INSERT policy
DROP POLICY IF EXISTS "Users can create activities (limit or premium)" ON public.user_activities;

-- Create new INSERT policy: 1 activity per month for free users (only count activities online 6+ hours)
-- Premium users have unlimited activities
CREATE POLICY "Users can create activities (limit or premium)" 
ON public.user_activities 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) 
  AND (
    -- Premium users: unlimited activities
    (EXISTS (
      SELECT 1 FROM profiles_private pp
      WHERE pp.user_id = auth.uid() AND pp.premium_override = true
    ))
    OR
    -- Free users: max 1 activity per month that has been online for 6+ hours
    -- Count only activities that are either still active OR were created more than 6 hours ago
    ((
      SELECT count(*) FROM user_activities ua
      WHERE ua.user_id = auth.uid()
        AND ua.created_at >= date_trunc('month', now())
        AND ua.created_at < (date_trunc('month', now()) + interval '1 month')
        AND (
          ua.is_active = true 
          OR ua.created_at <= (now() - interval '6 hours')
        )
    ) < 1)
  )
);