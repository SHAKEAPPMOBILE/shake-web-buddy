-- Update get_user_points function to include creator bonus points
-- Creator earns 5 points for every 5 attendees on their activities
CREATE OR REPLACE FUNCTION public.get_user_points(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    -- Check-in points
    COALESCE((
      SELECT SUM(points_earned) 
      FROM public.check_ins 
      WHERE user_id = target_user_id
    ), 0) +
    -- Creator bonus points: 5 points per 5 attendees
    COALESCE((
      SELECT SUM(FLOOR(participant_count / 5.0) * 5)
      FROM (
        SELECT 
          ua.id,
          (SELECT COUNT(*) FROM public.activity_joins aj WHERE aj.activity_id = ua.id) AS participant_count
        FROM public.user_activities ua
        WHERE ua.user_id = target_user_id AND ua.is_active = true
      ) AS activity_counts
      WHERE participant_count >= 5
    ), 0)
  )::INTEGER
$$;