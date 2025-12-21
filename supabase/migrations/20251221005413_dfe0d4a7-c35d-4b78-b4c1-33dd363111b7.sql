-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view profiles of activity participants" ON public.profiles;

-- Create a new policy that only allows users to view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);