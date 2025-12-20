-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all active activity joins" ON public.activity_joins;

-- Create new policy that only allows authenticated users to view active joins
CREATE POLICY "Authenticated users can view active activity joins" 
ON public.activity_joins 
FOR SELECT 
TO authenticated
USING (expires_at > now());