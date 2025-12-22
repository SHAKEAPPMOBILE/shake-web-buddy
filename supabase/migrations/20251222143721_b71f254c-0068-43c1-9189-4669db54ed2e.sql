-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create activities with limit" ON public.user_activities;

-- Create new policy with 5 activities limit
CREATE POLICY "Users can create activities with limit" 
ON public.user_activities 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) 
  AND (
    (SELECT count(*) FROM user_activities ua
     WHERE ua.user_id = auth.uid() 
     AND ua.created_at >= date_trunc('month', now()) 
     AND ua.created_at < (date_trunc('month', now()) + '1 mon'::interval)
    ) < 5
  )
);