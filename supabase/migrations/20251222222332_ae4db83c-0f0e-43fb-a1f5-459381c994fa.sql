-- Drop the old restrictive check constraint
ALTER TABLE public.activity_joins DROP CONSTRAINT IF EXISTS activity_joins_activity_type_check;

-- No constraint needed - activity types should be flexible