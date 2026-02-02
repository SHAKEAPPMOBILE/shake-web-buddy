-- Table to track daily "first" SMS notifications per city
-- Prevents sending duplicate "first of the day" notifications
CREATE TABLE public.daily_sms_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city text NOT NULL,
  notification_type text NOT NULL, -- 'first_plan' or 'first_activity_join'
  notification_date date NOT NULL DEFAULT CURRENT_DATE,
  triggered_by_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(city, notification_type, notification_date)
);

-- Enable RLS
ALTER TABLE public.daily_sms_tracking ENABLE ROW LEVEL SECURITY;

-- Only service role should access this table (edge functions)
-- No user-level policies needed since this is internal tracking