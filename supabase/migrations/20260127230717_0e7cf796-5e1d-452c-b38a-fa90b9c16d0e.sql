-- Add welcome_bonus_claimed column to track if user has claimed their bonus
ALTER TABLE public.profiles_private 
ADD COLUMN welcome_bonus_claimed boolean NOT NULL DEFAULT false;

-- Create function to check if profile is complete (all fields filled)
CREATE OR REPLACE FUNCTION public.is_profile_complete(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles p
    JOIN public.profiles_private pp ON p.user_id = pp.user_id
    WHERE p.user_id = target_user_id
      AND p.name IS NOT NULL AND p.name != ''
      AND p.avatar_url IS NOT NULL AND p.avatar_url != ''
      AND p.nationality IS NOT NULL AND p.nationality != ''
      AND p.occupation IS NOT NULL AND p.occupation != ''
      AND pp.date_of_birth IS NOT NULL
      AND pp.billing_email IS NOT NULL AND pp.billing_email != ''
  )
$$;

-- Create function to claim welcome bonus (returns true if claimed, false if already claimed or profile incomplete)
CREATE OR REPLACE FUNCTION public.claim_welcome_bonus(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  already_claimed boolean;
  profile_complete boolean;
BEGIN
  -- Check if already claimed
  SELECT welcome_bonus_claimed INTO already_claimed
  FROM public.profiles_private
  WHERE user_id = target_user_id;
  
  IF already_claimed THEN
    RETURN false;
  END IF;
  
  -- Check if profile is complete
  SELECT public.is_profile_complete(target_user_id) INTO profile_complete;
  
  IF NOT profile_complete THEN
    RETURN false;
  END IF;
  
  -- Claim the bonus
  UPDATE public.profiles_private
  SET welcome_bonus_claimed = true
  WHERE user_id = target_user_id;
  
  RETURN true;
END;
$$;

-- Update get_user_points to include welcome bonus
CREATE OR REPLACE FUNCTION public.get_user_points(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Welcome bonus (10 points)
    COALESCE((
      SELECT CASE WHEN welcome_bonus_claimed THEN 10 ELSE 0 END
      FROM public.profiles_private
      WHERE user_id = target_user_id
    ), 0) +
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
    ), 0) +
    -- Referral points
    COALESCE((
      SELECT SUM(points_awarded) 
      FROM public.referrals 
      WHERE referrer_user_id = target_user_id
    ), 0)
  )::INTEGER
$$;