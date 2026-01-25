-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Anyone can view active status videos" ON public.status_videos;

-- Create new SELECT policy that only shows videos from premium users publicly
-- Users can always see their own status videos
CREATE POLICY "View active status videos from premium users or own"
ON public.status_videos
FOR SELECT
USING (
  expires_at > now() 
  AND (
    -- User can always see their own status video
    auth.uid() = user_id
    OR
    -- Others can only see if the video owner is premium
    EXISTS (
      SELECT 1 FROM public.profiles_private pp
      WHERE pp.user_id = status_videos.user_id
      AND pp.premium_override = true
    )
  )
);