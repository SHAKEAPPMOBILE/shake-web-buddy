-- Ensure user_activities is readable by unauthenticated users.
-- Required for the share-landing page (/share/:id) which is viewed by users
-- who are not yet logged in. Without this the Supabase RLS blocks the SELECT
-- and the page incorrectly shows "Activity not found".
DROP POLICY IF EXISTS "Anyone can view active activities" ON public.user_activities;

CREATE POLICY "Anyone can view active activities"
ON public.user_activities
FOR SELECT
USING (is_active = true);
