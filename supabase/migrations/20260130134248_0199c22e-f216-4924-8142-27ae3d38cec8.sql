-- Create a function to get the activity limit for a user based on signup date
CREATE OR REPLACE FUNCTION public.get_user_activity_limit(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Premium users have no limit (return a high number)
      WHEN EXISTS (
        SELECT 1 FROM profiles_private pp 
        WHERE pp.user_id = target_user_id AND pp.premium_override = true
      ) THEN 999999
      -- First 30 days after signup: 3 activities per month
      WHEN (
        SELECT created_at FROM profiles_private pp WHERE pp.user_id = target_user_id
      ) > (now() - interval '30 days') THEN 3
      -- After first month: 2 activities per month
      ELSE 2
    END
$$;

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create activities (limit or premium)" ON public.user_activities;

-- Create the updated policy with tiered limits
CREATE POLICY "Users can create activities (limit or premium)" 
ON public.user_activities 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) 
  AND (
    (SELECT count(*) 
     FROM user_activities ua
     WHERE ua.user_id = auth.uid() 
       AND ua.created_at >= date_trunc('month', now()) 
       AND ua.created_at < (date_trunc('month', now()) + interval '1 month')
       AND (ua.is_active = true OR ua.created_at <= (now() - interval '6 hours'))
    ) < public.get_user_activity_limit(auth.uid())
  )
);