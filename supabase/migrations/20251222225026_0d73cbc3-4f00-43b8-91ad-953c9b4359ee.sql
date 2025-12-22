-- Add explicit deny for anonymous users (RLS and FORCE already enabled)
CREATE POLICY "Deny anonymous SELECT"
ON public.profiles_private
FOR SELECT
TO anon
USING (false);