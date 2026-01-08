-- Drop the existing check constraint
ALTER TABLE public.user_activities DROP CONSTRAINT IF EXISTS user_activities_activity_type_check;

-- Add a new check constraint that includes all activity types (existing + new)
ALTER TABLE public.user_activities ADD CONSTRAINT user_activities_activity_type_check 
CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'basketball', 'tennis-padel', 'football', 'shopping', 'arts', 'sunset', 'dance'));