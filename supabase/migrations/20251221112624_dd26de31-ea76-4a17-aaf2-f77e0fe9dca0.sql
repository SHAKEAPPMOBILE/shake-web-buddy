-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view messages for activities in their city" ON public.activity_messages;

-- Create new policy that requires authentication
CREATE POLICY "Authenticated users can view messages"
ON public.activity_messages
FOR SELECT
USING (auth.uid() IS NOT NULL);