-- Create check_ins table to track venue check-ins
CREATE TABLE public.check_ins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  city TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 5,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_check_ins_user_id ON public.check_ins(user_id);
CREATE INDEX idx_check_ins_checked_in_at ON public.check_ins(checked_in_at);

-- Prevent duplicate check-ins at same venue on same day using stored date column
CREATE UNIQUE INDEX idx_unique_daily_checkin 
  ON public.check_ins(user_id, activity_type, city, check_in_date);

-- Enable RLS
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- Users can view all check-ins (for leaderboard potential)
CREATE POLICY "Authenticated users can view check-ins"
  ON public.check_ins FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can only create their own check-ins
CREATE POLICY "Users can create their own check-ins"
  ON public.check_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create a function to get user's total points
CREATE OR REPLACE FUNCTION public.get_user_points(target_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points_earned), 0)::INTEGER
  FROM public.check_ins
  WHERE user_id = target_user_id
$$;

-- Enable realtime for check-ins
ALTER PUBLICATION supabase_realtime ADD TABLE public.check_ins;