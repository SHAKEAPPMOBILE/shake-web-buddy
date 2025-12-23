-- Drop the existing SELECT policy that requires authentication
DROP POLICY IF EXISTS "Authenticated users can view active activities" ON public.user_activities;

-- Create new policy allowing anyone to view active activities (public)
CREATE POLICY "Anyone can view active activities"
ON public.user_activities
FOR SELECT
USING (is_active = true);