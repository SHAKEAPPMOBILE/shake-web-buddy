-- Allow unauthenticated (anon) users to read basic profile info.
-- Required for the share landing page (/invite/:id) to show the inviter's
-- real name and avatar without requiring the visitor to be signed in.
CREATE POLICY "Anyone can view basic profile info"
ON public.profiles
FOR SELECT
TO anon
USING (true);
