-- Add referral_code column to profiles table
ALTER TABLE public.profiles
ADD COLUMN referral_code TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX idx_profiles_referral_code ON public.profiles(referral_code);

-- Create referrals table to track successful referrals
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL,
  referred_user_id UUID NOT NULL UNIQUE, -- A user can only be referred once
  points_awarded INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- RLS policies for referrals
CREATE POLICY "Users can view their own referrals" 
ON public.referrals 
FOR SELECT 
USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- Only the system (service role) should insert referrals, but we allow insert for the referred user
CREATE POLICY "Users can create referral when they sign up" 
ON public.referrals 
FOR INSERT 
WITH CHECK (auth.uid() = referred_user_id);

-- Update get_user_points function to include referral points
CREATE OR REPLACE FUNCTION public.get_user_points(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
    ), 0) +
    -- Referral points
    COALESCE((
      SELECT SUM(points_awarded) 
      FROM public.referrals 
      WHERE referrer_user_id = target_user_id
    ), 0)
  )::INTEGER
$$;

-- Function to generate a unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code(user_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  suffix TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Clean the name: lowercase, remove special chars, take first part
  base_code := lower(regexp_replace(split_part(COALESCE(user_name, 'user'), ' ', 1), '[^a-z0-9]', '', 'g'));
  
  -- If base_code is empty, use 'user'
  IF base_code = '' THEN
    base_code := 'user';
  END IF;
  
  -- Try to find a unique code with random suffix
  LOOP
    -- Generate 3-char alphanumeric suffix
    suffix := substr(md5(random()::text), 1, 3);
    final_code := base_code || '-' || suffix;
    
    -- Check if this code is unique
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = final_code) THEN
      RETURN final_code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      -- Fallback to longer suffix
      RETURN base_code || '-' || substr(md5(random()::text), 1, 8);
    END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-generate referral code when profile is created or name is set
CREATE OR REPLACE FUNCTION public.handle_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if referral_code is null and name exists
  IF NEW.referral_code IS NULL AND NEW.name IS NOT NULL THEN
    NEW.referral_code := public.generate_referral_code(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_referral_code
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_referral_code();

-- Generate referral codes for existing users who have names
UPDATE public.profiles
SET referral_code = public.generate_referral_code(name)
WHERE referral_code IS NULL AND name IS NOT NULL;