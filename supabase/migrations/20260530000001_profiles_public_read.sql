-- Allow any authenticated user to read all profiles.
-- Required for GlobalParticipantsSection ("Shakers nearby") to show other users.
-- The original policy only allowed users to view their own profile, so the query
-- was returning at most 1 row, causing the pill to disappear.
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);
