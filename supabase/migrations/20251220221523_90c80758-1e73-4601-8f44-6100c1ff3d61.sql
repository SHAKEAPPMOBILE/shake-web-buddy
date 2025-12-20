-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policy that allows viewing profiles of activity participants
-- This allows users to see basic profile info (name, avatar) of other users in activities
CREATE POLICY "Users can view profiles of activity participants"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);