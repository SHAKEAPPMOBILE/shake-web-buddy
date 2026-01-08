-- Drop existing policy
DROP POLICY IF EXISTS "Users can create activities (limit or premium)" ON public.user_activities;

-- Create updated policy with 3 free activities per month limit
CREATE POLICY "Users can create activities (limit or premium)" 
ON public.user_activities 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) AND (
    (
      (SELECT count(*) FROM user_activities ua
       WHERE ua.user_id = auth.uid() 
       AND ua.created_at >= date_trunc('month', now()) 
       AND ua.created_at < (date_trunc('month', now()) + interval '1 month')
      ) < 3
    ) 
    OR 
    (EXISTS (
      SELECT 1 FROM profiles_private pp
      WHERE pp.user_id = auth.uid() AND pp.premium_override = true
    ))
  )
);