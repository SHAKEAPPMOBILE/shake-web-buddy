-- Drop the restrictive check constraint to allow any activity type
ALTER TABLE public.user_activities DROP CONSTRAINT IF EXISTS user_activities_activity_type_check;