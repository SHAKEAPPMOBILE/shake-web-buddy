-- Drop the old constraint and add an updated one that includes 'general'
ALTER TABLE public.activity_joins DROP CONSTRAINT IF EXISTS activity_joins_activity_type_check;

ALTER TABLE public.activity_joins ADD CONSTRAINT activity_joins_activity_type_check 
CHECK (activity_type = ANY (ARRAY['lunch', 'dinner', 'drinks', 'brunch', 'hike', 'surf', 'run', 'co-working', 'basketball', 'tennis-padel', 'football', 'shopping', 'arts', 'sunset', 'dance', 'general']::text[]));